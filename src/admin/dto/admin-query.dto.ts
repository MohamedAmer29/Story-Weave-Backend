import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { UserRole } from '../../database/entities/user.entity';
import { StoryStatus } from '../../common/enums/story-status.enum';
import { StoryVisibility } from '../../common/enums/story-visibility.enum';
import { SourceType } from '../../common/enums/source-type.enum';
import { IllustrationPageStatus } from '../../illustration/enums/illustration-page-status.enum';

export class AdminUserQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  @ApiPropertyOptional({ description: 'Free-text search (email, name)' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional({ enum: UserRole })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiPropertyOptional({ description: 'Filter by active status' })
  @IsOptional()
  @Type(() => Boolean)
  isActive?: boolean;
}

export class UpdateUserRoleDto {
  @IsEnum(UserRole)
  role: UserRole;
}

export class UpdateUserActiveDto {
  @Type(() => Boolean)
  isActive: boolean;
}

export class AdminStoryQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  @ApiPropertyOptional({ description: 'Free-text search (title, description)' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional({ enum: StoryStatus })
  @IsOptional()
  @IsEnum(StoryStatus)
  status?: StoryStatus;

  @ApiPropertyOptional({ enum: StoryVisibility })
  @IsOptional()
  @IsEnum(StoryVisibility)
  visibility?: StoryVisibility;

  @ApiPropertyOptional({ enum: SourceType })
  @IsOptional()
  @IsEnum(SourceType)
  sourceType?: SourceType;

  @ApiPropertyOptional({ description: 'Filter by owner user id' })
  @IsOptional()
  @IsString()
  userId?: string;
}

export class FailedStoriesQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  @ApiPropertyOptional({
    enum: IllustrationPageStatus,
    default: IllustrationPageStatus.FAILED,
  })
  @IsOptional()
  @IsEnum(IllustrationPageStatus)
  imageStatus?: IllustrationPageStatus;
}

export class GenerationQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  @ApiPropertyOptional({ description: 'Filter by story id' })
  @IsOptional()
  @IsString()
  storyId?: string;

  @ApiPropertyOptional({
    enum: IllustrationPageStatus,
    description: 'Filter by page image status',
  })
  @IsOptional()
  @IsEnum(IllustrationPageStatus)
  imageStatus?: IllustrationPageStatus;
}

export class RetryStoryDto {
  @IsOptional()
  @IsIn(['page', 'cover'])
  scope: 'page' | 'cover' = 'page';
}

export const AUDIT_ACTION_VALUES = [
  'USER_UPDATE_ROLE',
  'USER_SET_ACTIVE',
  'USER_DEACTIVATE',
  'STORY_DELETE',
  'GENERATION_RETRY',
  'QUEUE_CLEAN',
  'AI_USAGE_RESET',
] as const;

export class AuditQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  @ApiPropertyOptional({ description: 'Filter by admin user id' })
  @IsOptional()
  @IsString()
  adminId?: string;

  @ApiPropertyOptional({ description: 'Filter by action' })
  @IsOptional()
  @IsIn(AUDIT_ACTION_VALUES)
  action?: string;
}
