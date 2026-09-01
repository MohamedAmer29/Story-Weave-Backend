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
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
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
import { StoryQueryDto } from './dto/story-query.dto';
import { StoryListQueryDto } from './dto/story-list-query.dto';
import {
  StoryResponseDto,
  PaginatedStoriesResponseDto,
} from './dto/story-response.dto';
import { StoryDetailsResponseDto } from './dto/story-details-response.dto';
import { StoryType } from '../../common/enums/story-type.enum';
import { StoryVisibility } from '../../common/enums/story-visibility.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt-auth.guard';
import { Public } from '../../common/decorators/public.decorator';

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
    @Param('id') id: string,
  ): Promise<StoryDetailsResponseDto> {
    return this.storyService.findOne(userId, id);
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
    @Param('id') id: string,
    @Body() updateStoryDto: UpdateStoryDto,
  ): Promise<StoryResponseDto> {
    return this.storyService.update(userId, id, updateStoryDto);
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
    @Param('id') id: string,
  ): Promise<void> {
    return this.storyService.remove(userId, id);
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
    @Param('id') id: string,
    @Body() body: { visibility: StoryVisibility },
  ): Promise<StoryResponseDto> {
    return this.storyService.updateVisibility(userId, id, body.visibility);
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
    @Param('id') id: string,
    @Body() body: { userId: string },
  ) {
    return this.storyService.shareStory(userId, id, body.userId);
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
    @Param('id') id: string,
    @Param('targetUserId') targetUserId: string,
  ): Promise<void> {
    return this.storyService.removeShare(userId, id, targetUserId);
  }

  @Get(':id/shares')
  @ApiOperation({ summary: 'List users with access to story' })
  @ApiResponse({ status: 200, description: 'List of shared users' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  async listShares(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.storyService.listShares(userId, id);
  }

  @Post('upload-pdf')
  @UseInterceptors(FileInterceptor('file'))
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
    @Body() body: { storyType?: any; visualStyle?: string; language?: string },
  ): Promise<StoryResponseDto> {
    return this.storyService.createFromPdf(userId, file, body);
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
}
