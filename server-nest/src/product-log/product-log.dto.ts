import { ApiProperty } from '@nestjs/swagger'
import { Transform, Type } from 'class-transformer'
import { IsArray, IsNumber, IsOptional } from 'class-validator'

import { PageRequest } from '@pengode/common/dtos'
import { ProductLog } from '@pengode/product-log/product-log'

export class ProductResponse {
  @ApiProperty()
  id: number

  @ApiProperty()
  title: string

  @ApiProperty()
  previewUrl: string

  @ApiProperty()
  price: string

  @ApiProperty()
  discount?: number | null
}

export class LogResponse {
  @ApiProperty()
  id: number

  @ApiProperty()
  name: string

  @ApiProperty({ name: 'product_url' })
  productUrl: string

  @ApiProperty({ type: 'text' })
  description: string

  @ApiProperty()
  product: ProductResponse

  @ApiProperty({ type: 'text' })
  createdAt: Date

  @ApiProperty({ type: 'text' })
  updatedAt: Date

  static create(log: ProductLog): LogResponse {
    return {
      id: log.id,
      name: log.name,
      product: {
        id: log.product.id,
        previewUrl: log.product.previewUrl,
        price: log.product.price.toString(),
        title: log.product.title,
        discount: log.product.discount,
      },
      description: log.description,
      productUrl: log.productUrl,
      createdAt: log.createdAt,
      updatedAt: log.createdAt,
    }
  }
}

export class FindAllRequest extends PageRequest {
  @Type(() => Number)
  @IsArray()
  @IsOptional()
  @IsNumber({}, { each: true })
  @Transform(({ value }) => (typeof value === 'string' ? [value] : value))
  @ApiProperty()
  invoiceIds?: number[]
}
