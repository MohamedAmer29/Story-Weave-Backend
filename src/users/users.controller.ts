import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Express, Request } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { LibraryQueryDto } from './dto/library-query.dto';
import { StoryListQueryDto } from '../modules/story/dto/story-list-query.dto';

const AVATAR_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the authenticated user profile' })
  @ApiResponse({ status: 200, description: 'User profile' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getProfile(@CurrentUser('id') userId: string) {
    const data = await this.usersService.getProfile(userId);
    return { success: true, data };
  }

  @Patch('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update the authenticated user profile' })
  @ApiResponse({ status: 200, description: 'Updated profile' })
  async updateProfile(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateProfileDto,
  ) {
    const data = await this.usersService.updateProfile(userId, dto);
    return { success: true, data };
  }

  @Post('me/avatar')
  @ApiBearerAuth()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req: Request, file, cb) => {
        if (!AVATAR_MIME_TYPES.includes(file.mimetype)) {
          cb(
            new BadRequestException(
              'Invalid file type. Only JPEG, PNG, WEBP and GIF images are allowed',
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
          description: 'Avatar image (JPEG, PNG, WEBP, GIF - max 5MB)',
        },
      },
      required: ['file'],
    },
  })
  @ApiOperation({ summary: 'Upload a profile avatar image' })
  @ApiResponse({ status: 201, description: 'Avatar uploaded' })
  async uploadAvatar(
    @CurrentUser('id') userId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    const data = await this.usersService.updateAvatar(userId, file);
    return { success: true, data };
  }

  @Get('me/stats')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get account statistics for the current user' })
  @ApiResponse({ status: 200, description: 'Account statistics' })
  async getStats(@CurrentUser('id') userId: string) {
    const data = await this.usersService.getStats(userId);
    return { success: true, data };
  }

  @Get('me/stories')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the current user story library' })
  @ApiResponse({ status: 200, description: 'Paginated story library' })
  async getStories(
    @CurrentUser('id') userId: string,
    @Query() query: LibraryQueryDto,
  ) {
    const result = await this.usersService.getStoryLibrary(userId, query);
    return { success: true, ...result };
  }

  @Get('me/shared-stories')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get stories explicitly shared with the current user' })
  @ApiResponse({ status: 200, description: 'Paginated shared stories' })
  async getSharedStories(
    @CurrentUser('id') userId: string,
    @Query() query: StoryListQueryDto,
  ) {
    const result = await this.usersService.getSharedStories(userId, query);
    return { success: true, ...result };
  }

  @Public()
  @Get(':userId/public-profile')
  @ApiOperation({ summary: 'Get a public author profile' })
  @ApiResponse({ status: 200, description: 'Public author profile' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getPublicProfile(@Param('userId') userId: string) {
    const data = await this.usersService.getPublicProfile(userId);
    return { success: true, data };
  }

  @Public()
  @Get(':userId/public-stories')
  @ApiOperation({ summary: 'Get public stories from a specific author' })
  @ApiResponse({ status: 200, description: 'Paginated public stories' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getPublicStories(
    @Param('userId') userId: string,
    @Query() query: StoryListQueryDto,
  ) {
    const result = await this.usersService.getPublicStories(userId, query);
    return { success: true, ...result };
  }
}