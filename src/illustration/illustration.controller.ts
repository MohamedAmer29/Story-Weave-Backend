import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { StoryService } from '../modules/story/story.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { IllustrationService } from './illustration.service';
import { IllustrationStatusService } from './services/illustration-status.service';
import { GenerateIllustrationsDto } from './dto/generate-illustrations.dto';

@ApiTags('illustrations')
@Controller('stories')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class IllustrationController {
  constructor(
    private readonly illustrationService: IllustrationService,
    private readonly illustrationStatusService: IllustrationStatusService,
    private readonly storyService: StoryService,
  ) {}

  @Post(':storyId/generate-illustrations')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Queue image generation for all story pages' })
  @ApiResponse({ status: 202, description: 'Illustrations queued' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  async generateIllustrations(
    @CurrentUser('id') userId: string,
    @Param('storyId') storyId: string,
    @Body() dto: GenerateIllustrationsDto,
  ) {
    return this.illustrationService.queueStoryIllustrations(
      userId,
      storyId,
      dto,
    );
  }

  @Post(':storyId/pages/:pageId/regenerate')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Queue regeneration of a single page image' })
  @ApiResponse({ status: 202, description: 'Regeneration queued' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  async regeneratePage(
    @CurrentUser('id') userId: string,
    @Param('storyId') storyId: string,
    @Param('pageId') pageId: string,
  ) {
    return this.illustrationService.regeneratePage(userId, storyId, pageId);
  }

  @Post(':storyId/cover/regenerate')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Queue regeneration of story cover image' })
  @ApiResponse({ status: 202, description: 'Cover regeneration queued' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  async regenerateCover(
    @CurrentUser('id') userId: string,
    @Param('storyId') storyId: string,
  ) {
    return this.illustrationService.regenerateCover(userId, storyId);
  }

  @Get(':storyId/illustrations/status')
  @ApiOperation({ summary: 'Get illustration status for a story' })
  @ApiResponse({ status: 200, description: 'Illustration status' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  async getIllustrationStatus(
    @CurrentUser('id') userId: string,
    @Param('storyId') storyId: string,
  ) {
    const storyPages = await this.storyService.getPagesForUser(storyId, userId);
    const result = this.illustrationStatusService.computeStatus(storyPages);

    return {
      success: true,
      data: {
        storyId,
        status: result.status,
        totalPages: result.totalPages,
        queued: result.queued,
        generating: result.generating,
        uploading: result.uploading,
        completed: result.completed,
        failed: result.failed,
        progress: result.progress,
      },
    };
  }
}
