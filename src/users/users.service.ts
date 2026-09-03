import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../database/entities/user.entity';
import { Story } from '../database/entities/story.entity';
import { StoryVisibility } from '../common/enums/story-visibility.enum';
import { StoryStatus } from '../common/enums/story-status.enum';
import { IllustrationPageStatus } from '../illustration/enums/illustration-page-status.enum';
import { StoryLibraryService } from '../modules/story/services/story-library.service';
import { StoryListFilters } from '../modules/story/services/story-library.service';
import {
  StoryLibraryItemDto,
  PaginatedLibraryResponseDto,
} from '../modules/story/dto/story-library-response.dto';
import { PublicCacheService } from '../common/services/public-cache.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import {
  UserProfileDto,
  toUserProfileDto,
} from './serializers/user-response.serializer';

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const ALLOWED_AVATAR_MIME = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];

export interface UserStatistics {
  totalStories: number;
  publicStories: number;
  privateStories: number;
  sharedStories: number;
  completedStories: number;
  processingStories: number;
  failedStories: number;
  draftStories: number;
  totalPages: number;
  illustratedPages: number;
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Story)
    private readonly storyRepository: Repository<Story>,
    private readonly storyLibraryService: StoryLibraryService,
    private readonly publicCacheService: PublicCacheService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  async getProfile(userId: string): Promise<UserProfileDto> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return toUserProfileDto(user);
  }

  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<UserProfileDto> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (dto.firstName !== undefined) {
      user.firstName = dto.firstName.trim();
    }
    if (dto.lastName !== undefined) {
      user.lastName = dto.lastName.trim();
    }
    if (dto.avatarUrl !== undefined) {
      user.avatarUrl = dto.avatarUrl;
    }

    if (dto.firstName !== undefined || dto.lastName !== undefined) {
      user.name = `${user.firstName} ${user.lastName}`.trim();
    }

    const saved = await this.userRepository.save(user);

    await this.publicCacheService.bust();

    return toUserProfileDto(saved);
  }

  async updateAvatar(
    userId: string,
    file: Express.Multer.File | undefined,
  ): Promise<{ avatarUrl: string; avatarPublicId: string }> {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    if (!ALLOWED_AVATAR_MIME.includes(file.mimetype)) {
      throw new BadRequestException(
        'Invalid file type. Only JPEG, PNG, WEBP and GIF images are allowed',
      );
    }

    if (file.size > MAX_AVATAR_BYTES) {
      throw new BadRequestException('Avatar image exceeds 5MB limit');
    }

    const user = await this.userRepository.findOne({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Upload the new avatar first; only delete the old one after success.
    const upload = await this.cloudinaryService.uploadImage(file.buffer, {
      folder: `storyforge/users/${userId}/avatar`,
      publicId: 'avatar',
    });

    const previousPublicId = user.avatarPublicId;

    user.avatarUrl = upload.secureUrl;
    user.avatarPublicId = upload.publicId;
    await this.userRepository.save(user);

    if (previousPublicId && previousPublicId !== upload.publicId) {
      await this.cloudinaryService.deleteImage(previousPublicId);
    }

    await this.publicCacheService.bust();

    this.logger.log(`Avatar updated for user: ${userId}`);

    return {
      avatarUrl: upload.secureUrl,
      avatarPublicId: upload.publicId,
    };
  }

  async getStats(userId: string): Promise<UserStatistics> {
    const [statusRows, visibilityRows, totalPages, illustratedPages] =
      await Promise.all([
        this.storyRepository
          .createQueryBuilder('story')
          .select('story.status', 'status')
          .addSelect('COUNT(*)', 'count')
          .where('story.userId = :userId', { userId })
          .groupBy('story.status')
          .getRawMany(),
        this.storyRepository
          .createQueryBuilder('story')
          .select('story.visibility', 'visibility')
          .addSelect('COUNT(*)', 'count')
          .where('story.userId = :userId', { userId })
          .groupBy('story.visibility')
          .getRawMany(),
        this.storyRepository
          .createQueryBuilder('story')
          .select('COUNT(*)', 'count')
          .where('story.userId = :userId', { userId })
          .innerJoin('story.pages', 'page')
          .getRawOne(),
        this.storyRepository
          .createQueryBuilder('story')
          .select('COUNT(*)', 'count')
          .where('story.userId = :userId', { userId })
          .innerJoin('story.pages', 'page', 'page.imageStatus = :completed', {
            completed: IllustrationPageStatus.COMPLETED,
          })
          .getRawOne(),
      ]);

    const countFor = (key: string): number =>
      Number(statusRows.find((r) => r.status === key)?.count) || 0;
    const visCountFor = (key: string): number =>
      Number(visibilityRows.find((r) => r.visibility === key)?.count) || 0;

    return {
      totalStories: statusRows.reduce(
        (acc, r) => acc + Number(r.count || 0),
        0,
      ),
      publicStories: visCountFor(StoryVisibility.PUBLIC),
      privateStories: visCountFor(StoryVisibility.PRIVATE),
      sharedStories: visCountFor(StoryVisibility.SHARED),
      completedStories: countFor(StoryStatus.READY),
      processingStories: countFor(StoryStatus.PROCESSING),
      failedStories: countFor(StoryStatus.FAILED),
      draftStories: countFor(StoryStatus.DRAFT),
      totalPages: Number(totalPages?.count) || 0,
      illustratedPages: Number(illustratedPages?.count) || 0,
    };
  }

  async getStoryLibrary(
    userId: string,
    filters: StoryListFilters,
  ): Promise<PaginatedLibraryResponseDto> {
    return this.storyLibraryService.findOwned(userId, filters);
  }

  async getSharedStories(
    userId: string,
    filters: StoryListFilters,
  ): Promise<PaginatedLibraryResponseDto> {
    return this.storyLibraryService.findShared(userId, filters);
  }

  async getRecentStories(
    userId: string,
    limit = 6,
  ): Promise<StoryLibraryItemDto[]> {
    return this.storyLibraryService.findRecent(userId, limit);
  }

  async getPublicProfile(userId: string) {
    const cacheKey = userId;
    const cached = await this.publicCacheService.get<PublicAuthorProfile>(
      'public-author-profile',
      cacheKey,
    );
    if (cached) {
      return cached;
    }

    const user = await this.userRepository.findOne({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const publicStories = await this.storyRepository.count({
      where: {
        userId,
        visibility: StoryVisibility.PUBLIC,
      },
    });

    const profile: PublicAuthorProfile = {
      id: user.id,
      name: user.name || `${user.firstName} ${user.lastName}`.trim(),
      avatarUrl: user.avatarUrl ?? null,
      stats: { publicStories },
    };

    await this.publicCacheService.set(
      'public-author-profile',
      cacheKey,
      profile,
    );

    return profile;
  }

  async getPublicStories(
    userId: string,
    filters: StoryListFilters,
  ): Promise<PaginatedLibraryResponseDto> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: { id: true, isActive: true },
    });
    if (!user || !user.isActive) {
      throw new NotFoundException('User not found');
    }

    return this.storyLibraryService.findPublic(filters, userId);
  }
}

export interface PublicAuthorProfile {
  id: string;
  name: string;
  avatarUrl: string | null;
  stats: { publicStories: number };
}
