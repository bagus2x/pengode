import { CACHE_MANAGER } from '@nestjs/cache-manager'
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import { InjectRepository } from '@nestjs/typeorm'
import * as bcrypt from 'bcryptjs'
import { Cache } from 'cache-manager'
import { Repository } from 'typeorm'

import {
  AuthResponse,
  SignInRequest,
  SignUpRequest,
} from '@pengode/auth/auth.dto'
import { AuthUser } from '@pengode/auth/utils/auth-user'
import { User } from '@pengode/user/user'

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @Inject(CACHE_MANAGER)
    private readonly cache: Cache,
    private readonly authUser: AuthUser,
  ) {}

  async signUp(req: SignUpRequest): Promise<AuthResponse> {
    const existingUser = await this.userRepository.findOne({
      where: [{ email: req.email }, { username: req.username }],
    })
    if (existingUser) {
      throw new ConflictException('username or email already exists')
    }

    const hashedPassword = await bcrypt.hash(req.password, 10)

    const newUser = await this.userRepository.save({
      email: req.email,
      username: req.username,
      name: req.name,
      password: hashedPassword,
    })

    const tokens = await this.getTokens(newUser.id, newUser.username)
    const ttl = 7 * 24 * 60 * 60 * 1000
    await this.cache.set(`${newUser.id}`, tokens.refreshToken, ttl)

    return {
      user: {
        id: newUser.id,
        email: newUser.email,
        username: newUser.username,
        name: newUser.name,
        photo: newUser.photo,
      },
      ...tokens,
    }
  }

  async signIn(req: SignInRequest): Promise<AuthResponse> {
    const user = await this.userRepository.findOne({
      where: [{ email: req.username }, { username: req.username }],
    })
    if (!user) {
      throw new NotFoundException('user does not exists')
    }

    const passwordMatches = await bcrypt.compare(req.password, user.password)
    if (!passwordMatches) {
      throw new BadRequestException('password does not match')
    }

    const tokens = await this.getTokens(user.id, user.username)
    const ttl = 7 * 24 * 60 * 60 * 1000
    await this.cache.set(`${user.id}`, tokens.refreshToken, ttl)

    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        name: user.name,
        photo: user.photo,
      },
      ...tokens,
    }
  }

  private async getTokens(userId: number, username: string) {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        {
          sub: `${userId}`,
          userId,
          username,
        },
        {
          secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
          expiresIn: '15m',
        },
      ),
      this.jwtService.signAsync(
        {
          sub: `${userId}`,
          userId,
          username,
        },
        {
          secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
          expiresIn: '7d',
        },
      ),
    ])

    return {
      accessToken,
      refreshToken,
    }
  }

  async signOut(): Promise<void> {
    const userId = this.authUser.user.sub
    await this.cache.del(userId)
  }

  async refreshTokens() {
    const userId = this.authUser.user.userId
    const refreshToken = this.authUser.user.refreshToken
    const user = await this.userRepository.findOneBy({ id: userId })
    const cachedRefreshToken = await this.cache.get(`${userId}`)
    if (
      !user ||
      !refreshToken ||
      !cachedRefreshToken ||
      refreshToken !== cachedRefreshToken
    ) {
      throw new ForbiddenException('Access Denied')
    }

    const refreshTokenMatches = await this.jwtService.verifyAsync(
      refreshToken,
      { secret: this.configService.get<string>('JWT_REFRESH_SECRET') },
    )
    if (!refreshTokenMatches) {
      throw new ForbiddenException('Access Denied')
    }

    const tokens = await this.getTokens(user.id, user.username)

    this.cache.set(`${userId}`, tokens.refreshToken)

    return tokens
  }
}
