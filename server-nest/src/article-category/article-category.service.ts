import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { LessThan, Repository } from 'typeorm'

import { ArticleCategory } from '@pengode/article-category/article-category'
import {
  CategoryResponse,
  CreateCategoryRequest,
  FindAllRequest,
} from '@pengode/article-category/article-category.dto'
import { PageResponse } from '@pengode/common/dtos'

@Injectable()
export class ArticleCategoryService {
  constructor(
    @InjectRepository(ArticleCategory)
    private readonly articleCategoryRepository: Repository<ArticleCategory>,
  ) {}

  async create(req: CreateCategoryRequest): Promise<CategoryResponse> {
    const category = await this.articleCategoryRepository.save({
      name: req.name,
    })

    return CategoryResponse.create(category)
  }

  async findAll(req: FindAllRequest): Promise<PageResponse<CategoryResponse>> {
    const categories = await this.articleCategoryRepository.find({
      where: {
        id: LessThan(req.cursor),
      },
      take: req.size,
      order: {
        id: 'DESC',
      },
    })

    return {
      items: categories.map(CategoryResponse.create),
      nextCursor: categories[categories.length - 1]?.id || 0,
    }
  }

  async findById(categoryId: number): Promise<CategoryResponse> {
    const category = await this.articleCategoryRepository.findOne({
      where: { id: categoryId },
    })
    if (!category) {
      throw new NotFoundException('category is not found')
    }

    return CategoryResponse.create(category)
  }
}
