import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Request } from 'express';
import { extname } from 'node:path';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { StoryService } from './story.service';
import { StoryLibraryService } from './services/story-library.service';
import { CreateStoryDto } from './dto/create-story.dto';
import { UpdateStoryDto } from './dto/update-story.dto';
import { UploadPdfDto } from './dto/upload-pdf.dto';
import { ShareStoryDto } from './dto/share-story.dto';
import { UpdateVisibilityDto } from './dto/update-visibility.dto';
import { StoryQueryDto } from './dto/story-query.dto';
import { StoryListQueryDto } from './dto/story-list-query.dto';
import {
  StoryResponseDto,
  PaginatedStoriesResponseDto,
} from './dto/story-response.dto';
import { StoryDetailsResponseDto } from './dto/story-details-response.dto';
import { CivilizationsMetaResponseDto } from './dto/civilizations-meta.dto';
import { StoryType } from '../../common/enums/story-type.enum';
import { STORY_CIVILIZATION_VALUES } from '../../common/enums/story-civilization.enum';
import {
  CIVILIZATION_REGIONS,
  getCivilizationsByRegion,
} from '../../common/constants/civilizations.constants';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt-auth.guard';
import { Public } from '../../common/decorators/public.decorator';
import {
  UuidParamDto,
  UuidTargetUserIdParamDto,
} from '../../common/dto/uuid-param.dto';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { StoryPageIdParamDto } from '../../common/dto/uuid-param.dto';
import {
  AppendStoryDto,
  StoryContentDto,
  ReorderStoryPagesDto,
} from './dto/story-content.dto';
import { AppendStoryResponseDto } from './dto/append-story-response.dto';

// Rate limit metadata key (used by the global RateLimitGuard)
const RATE_LIMIT_KEY = 'rateLimit';

@ApiTags('stories')
@Controller('stories')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class StoryController {
  constructor(
    private readonly storyService: StoryService,
    private readonly storyLibraryService: StoryLibraryService,
  ) {}

  @Post()
  @RateLimit({ ttl: 300, limit: 30 })
  @ApiOperation({ summary: 'Create a new story' })
  @ApiResponse({ status: 201, type: StoryResponseDto })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async create(
    @CurrentUser('id') userId: string,
    @Body() createStoryDto: CreateStoryDto,
  ): Promise<StoryResponseDto> {
    return this.storyService.create(userId, createStoryDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all stories for current user (owned + public + shared)',
  })
  @ApiResponse({ status: 200, type: PaginatedStoriesResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findAll(
    @CurrentUser('id') userId: string,
    @Query() queryDto: StoryQueryDto,
  ): Promise<PaginatedStoriesResponseDto> {
    return this.storyService.findAll(userId, queryDto);
  }

  @Get('my')
  @ApiOperation({ summary: 'Get stories owned by current user' })
  @ApiResponse({ status: 200, type: PaginatedStoriesResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findMyStories(
    @CurrentUser('id') userId: string,
    @Query() queryDto: StoryQueryDto,
  ): Promise<PaginatedStoriesResponseDto> {
    return this.storyService.findMyStories(userId, queryDto);
  }

  @Get('shared')
  @ApiOperation({ summary: 'Get stories shared with current user' })
  @ApiResponse({ status: 200, type: PaginatedStoriesResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findSharedStories(
    @CurrentUser('id') userId: string,
    @Query() queryDto: StoryQueryDto,
  ): Promise<PaginatedStoriesResponseDto> {
    return this.storyService.findSharedStories(userId, queryDto);
  }

  @Public()
  @Get('public')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'List public stories (no authentication required)',
  })
  @ApiResponse({ status: 200, description: 'Paginated public stories' })
  async listPublicStories(@Query() query: StoryListQueryDto) {
    const result = await this.storyLibraryService.findPublic(query);
    return { success: true, ...result };
  }

  @Public()
  @Get('public/search')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Search public stories by title or description (public)',
  })
  @ApiResponse({ status: 200, description: 'Paginated public stories' })
  async searchPublicStories(@Query() query: StoryListQueryDto) {
    const result = await this.storyLibraryService.findPublic({
      ...query,
      search: query.search || '',
    });
    return { success: true, ...result };
  }

  @Public()
  @Get('types')
  @ApiOperation({ summary: 'Get supported story types (genres)' })
  @ApiResponse({ status: 200, description: 'List of story types' })
  async getTypes() {
    const types = Object.values(StoryType) as string[];
    const data = types.map((t) => ({
      value: t,
      label: t
        .replace(/_/g, ' ')
        .toLowerCase()
        .replace(/(^|\s)\S/g, (s) => s.toUpperCase()),
    }));
    return { data };
  }

  @Public()
  @Get('meta/civilizations')
  @ApiOperation({
    summary: 'Get supported civilizations grouped by region (public)',
  })
  @ApiResponse({ status: 200, type: CivilizationsMetaResponseDto })
  getCivilizationsMeta(): CivilizationsMetaResponseDto {
    const data = CIVILIZATION_REGIONS.map((region) => ({
      id: region,
      options: getCivilizationsByRegion(region).map((c) => ({
        value: c.value,
        label: c.label,
        region: c.region,
        kind: c.kind,
      })),
    }));
    return { data };
  }

  @Public()
  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({
    summary:
      'Get a story by ID (guest-accessible for PUBLIC stories; owner/shared access otherwise)',
  })
  @ApiResponse({ status: 200, type: StoryDetailsResponseDto })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  async findOne(
    @CurrentUser('id') userId: string | undefined,
    @Param() params: UuidParamDto,
  ): Promise<StoryDetailsResponseDto> {
    return this.storyService.findOne(userId, params.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a story' })
  @ApiResponse({ status: 200, type: StoryResponseDto })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  async update(
    @CurrentUser('id') userId: string,
    @Param() params: UuidParamDto,
    @Body() updateStoryDto: UpdateStoryDto,
  ): Promise<StoryResponseDto> {
    return this.storyService.update(userId, params.id, updateStoryDto);
  }

  @Post(':id/append')
  @RateLimit({ ttl: 300, limit: 10 })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024, files: 1 },
      fileFilter: (_req: Request, file, cb) => {
        const isPdf =
          file.mimetype === 'application/pdf' &&
          extname(file.originalname).toLowerCase() === '.pdf';
        if (!isPdf) {
          cb(
            new BadRequestException(
              'Invalid file type. Only PDF files are allowed',
            ),
            false,
          );
          return;
        }
        cb(null, true);
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        content: {
          type: 'string',
          maxLength: 100000,
          description: 'Continuation text',
        },
        file: {
          type: 'string',
          format: 'binary',
          description: 'PDF containing the continuation',
        },
      },
    },
  })
  @ApiOperation({ summary: 'Append text or a PDF continuation to a story' })
  @ApiResponse({ status: 200, type: AppendStoryResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid continuation or PDF' })
  @ApiResponse({ status: 403, description: 'Only the story owner can append' })
  async appendText(
    @CurrentUser('id') userId: string,
    @Param() params: UuidParamDto,
    @Body() body: AppendStoryDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.storyService.append(userId, params.id, body?.content, file);
  }

  @Get(':storyId/pages')
  @UseGuards(OptionalJwtAuthGuard)
  async getPages(
    @CurrentUser('id') userId: string | undefined,
    @Param('storyId') storyId: string,
  ) {
    return this.storyService.getPages(storyId, userId);
  }

  @Patch(':storyId/pages/reorder')
  async reorderPages(
    @CurrentUser('id') userId: string,
    @Param('storyId') storyId: string,
    @Body() body: ReorderStoryPagesDto,
  ) {
    return this.storyService.reorderPages(userId, storyId, body.pageIds);
  }

  @Patch(':storyId/pages/:pageId')
  async updatePage(
    @CurrentUser('id') userId: string,
    @Param() params: StoryPageIdParamDto,
    @Body() body: StoryContentDto,
  ) {
    return this.storyService.updatePage(
      userId,
      params.storyId,
      params.pageId,
      body.content,
    );
  }

  @Delete(':storyId/pages/:pageId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deletePage(
    @CurrentUser('id') userId: string,
    @Param() params: StoryPageIdParamDto,
  ) {
    return this.storyService.deletePage(userId, params.storyId, params.pageId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a story' })
  @ApiResponse({ status: 204, description: 'No Content' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  async remove(
    @CurrentUser('id') userId: string,
    @Param() params: UuidParamDto,
  ): Promise<void> {
    return this.storyService.remove(userId, params.id);
  }

  @Patch(':id/visibility')
  @ApiOperation({ summary: 'Update story visibility' })
  @ApiResponse({ status: 200, type: StoryResponseDto })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  async updateVisibility(
    @CurrentUser('id') userId: string,
    @Param() params: UuidParamDto,
    @Body() body: UpdateVisibilityDto,
  ): Promise<StoryResponseDto> {
    return this.storyService.updateVisibility(
      userId,
      params.id,
      body.visibility,
    );
  }

  @Post(':id/share')
  @ApiOperation({ summary: 'Share story with a user' })
  @ApiResponse({ status: 200, description: 'Share created' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  async shareStory(
    @CurrentUser('id') userId: string,
    @Param() params: UuidParamDto,
    @Body() body: ShareStoryDto,
  ) {
    return this.storyService.shareStory(userId, params.id, body.email);
  }

  @Delete(':id/share/:targetUserId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove user access from story' })
  @ApiResponse({ status: 204, description: 'No Content' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  async removeShare(
    @CurrentUser('id') userId: string,
    @Param() params: UuidTargetUserIdParamDto,
  ): Promise<void> {
    return this.storyService.removeShare(
      userId,
      params.id,
      params.targetUserId,
    );
  }

  @Get(':id/shares')
  @ApiOperation({ summary: 'List users with access to story' })
  @ApiResponse({ status: 200, description: 'List of shared users' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  async listShares(
    @CurrentUser('id') userId: string,
    @Param() params: UuidParamDto,
  ) {
    return this.storyService.listShares(userId, params.id);
  }

  @Post('upload-pdf')
  @RateLimit({ ttl: 300, limit: 10 })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024, files: 1 },
      fileFilter: (_req: Request, file, cb) => {
        if (file.mimetype !== 'application/pdf') {
          cb(
            new BadRequestException(
              'Invalid file type. Only PDF files are allowed',
            ),
            false,
          );
          return;
        }
        cb(null, true);
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'PDF file to upload',
        },
        storyType: {
          type: 'string',
          description: 'Story type (genre) - required',
        },
        visualStyle: {
          type: 'string',
          description: 'Optional visual style for illustrations',
        },
        language: {
          type: 'string',
          description: 'Optional story language (ARABIC or ENGLISH)',
        },
        era: {
          type: 'string',
          enum: [
            'BCE',
            'CE',
            'MODERN',
            'FIRST_AGE',
            'SECOND_AGE',
            'THIRD_AGE',
            'FOURTH_AGE',
            'FOURTH_AGE_OF_MIDDLE_EARTH',
            'UNSPECIFIED',
          ],
          description: 'Optional historical era of the story',
        },
        year: {
          type: 'integer',
          minimum: 1,
          maximum: 10000,
          description:
            'Optional year, interpreted together with `era` (e.g. 1250 for 1250 BCE)',
        },
        location: {
          type: 'string',
          maxLength: 200,
          description: 'Optional historical/geographical location',
        },
        civilization: {
          type: 'string',
          enum: STORY_CIVILIZATION_VALUES,
          description:
            'Optional civilization. `EGYPTIAN` and `ANCIENT_EGYPTIAN` are separate.',
        },
        customCivilization: {
          type: 'string',
          maxLength: 100,
          description:
            'Required only when `civilization` is CUSTOM. Framed as contextual metadata.',
        },
        theme: {
          type: 'string',
          enum: [
            'FANTASY',
            'HISTORICAL',
            'ADVENTURE',
            'ROMANCE',
            'MYSTERY',
            'WAR',
            'HORROR',
            'COMEDY',
            'DRAMA',
            'MYTHOLOGY',
            'RELIGIOUS',
            'EPIC_ADVENTURE',
            'HEROIC_FANTASY',
            'MYTHIC_ADVENTURE',
            'DARK_ADVENTURE',
            'CUSTOM',
            'UNSPECIFIED',
          ],
          description: 'Optional story theme controlling illustration style',
        },
        customTheme: {
          type: 'string',
          maxLength: 100,
          description:
            'Required only when `theme` is CUSTOM. Framed as contextual metadata.',
        },
      },
      required: ['file', 'storyType'],
    },
  })
  @ApiOperation({ summary: 'Upload a PDF to create a story' })
  @ApiResponse({ status: 201, type: StoryResponseDto })
  @ApiResponse({ status: 400, description: 'Bad Request - Invalid PDF' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async uploadPdf(
    @CurrentUser('id') userId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: UploadPdfDto,
  ): Promise<StoryResponseDto> {
    return this.storyService.createFromPdf(userId, file, body);
  }
}
