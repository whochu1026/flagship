import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  MinLength,
} from 'class-validator';

export class CreateFlagDto {
  @ApiProperty({ example: 'new_dashboard' })
  @IsString()
  @Matches(/^[a-z0-9_]+$/, {
    message: 'key must be snake_case alphanumeric',
  })
  key!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: true })
  @IsBoolean()
  enabled!: boolean;

  @ApiProperty({ example: 30 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  rolloutPercentage!: number;

  @ApiProperty({ type: [String], example: ['user_101'] })
  @IsArray()
  @IsString({ each: true })
  targetUsers!: string[];
}

export class UpdateFlagDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  rolloutPercentage?: number;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  targetUsers?: string[];
}

export class EvaluateDto {
  @ApiProperty({ example: 'new_dashboard' })
  @IsString()
  key!: string;

  @ApiPropertyOptional({ example: 'user_101' })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiProperty({ enum: ['DEVELOPMENT', 'STAGING', 'PRODUCTION'] })
  @IsIn(['DEVELOPMENT', 'STAGING', 'PRODUCTION'])
  environment!: 'DEVELOPMENT' | 'STAGING' | 'PRODUCTION';
}
