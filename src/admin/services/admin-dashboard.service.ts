import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from '../../database/entities/user.entity';
import { Story } from '../../database/entities/story.entity';
import { StoryPage } from '../../database/entities/story-page.entity';
import { StoryStatus } from '../../common/enums/story-status.enum';
import { StoryVisibility } from '../../common/enums/story-visibility.enum';
import { IllustrationPageStatus } from '../../illustration/enums/illustration-page-status.enum';
import { AiUsageService } from '../../ai/ai-usage.service';

@Injectable()
export class AdminDashboardService {
  private readonly logger = new Logger(AdminDashboardService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Story)
    private readonly storyRepository: Repository<Story>,
    @InjectRepository(StoryPage)
    private readonly storyPageRepository: Repository<StoryPage>,
    private readonly usageService: AiUsageService,
  ) {}

  async getSummary() {
    const [userStats, storyStats, storyVis, pageCounts, recentUsers] =
      await Promise.all([
        this.userRepository
          .createQueryBuilder('user')
          .select('user.role', 'role')
          .addSelect('COUNT(*)', 'count')
          .addSelect(`COUNT(*) FILTER (WHERE user.isActive = true)`, 'active')
          .groupBy('user.role')
          .getRawMany(),
        this.storyRepository
          .createQueryBuilder('story')
          .select('story.status', 'status')
          .addSelect('COUNT(*)', 'count')
          .groupBy('story.status')
          .getRawMany(),
        this.storyRepository
          .createQueryBuilder('story')
          .select('story.visibility', 'visibility')
          .addSelect('COUNT(*)', 'count')
          .groupBy('story.visibility')
          .getRawMany(),
        this.storyPageRepository
          .createQueryBuilder('page')
          .select('COUNT(*)', 'total')
          .addSelect(
            `COUNT(*) FILTER (WHERE page.imageStatus = :completed)`,
            'completed',
          )
          .addSelect(
            `COUNT(*) FILTER (WHERE page.imageStatus = :failed)`,
            'failed',
          )
          .addSelect(
            `COUNT(*) FILTER (WHERE page.imageStatus IN (:...inFlight))`,
            'inFlight',
          )
          .setParameters({
            completed: IllustrationPageStatus.COMPLETED,
            failed: IllustrationPageStatus.FAILED,
            inFlight: [
              IllustrationPageStatus.QUEUED,
              IllustrationPageStatus.GENERATING,
              IllustrationPageStatus.UPLOADING,
            ],
          })
          .getRawOne(),
        this.userRepository
          .createQueryBuilder('user')
          .orderBy('user.createdAt', 'DESC')
          .take(5)
          .select([
            'user.id',
            'user.firstName',
            'user.lastName',
            'user.name',
            'user.email',
            'user.role',
            'user.isActive',
            'user.createdAt',
          ])
          .getMany(),
      ]);

    const countByRole = (role: UserRole) =>
      userStats.find((r) => r.role === role)?.count
        ? Number(userStats.find((r) => r.role === role).count)
        : 0;
    const totalUsers = userStats.reduce(
      (acc, r) => acc + Number(r.count || 0),
      0,
    );
    const activeUsers = userStats.reduce(
      (acc, r) => acc + Number(r.active || 0),
      0,
    );

    const storyCountFor = (status: StoryStatus) =>
      storyStats.find((r) => r.status === status)?.count
        ? Number(storyStats.find((r) => r.status === status).count)
        : 0;
    const totalStories = storyStats.reduce(
      (acc, r) => acc + Number(r.count || 0),
      0,
    );
    const visCountFor = (visibility: StoryVisibility) =>
      storyVis.find((r) => r.visibility === visibility)?.count
        ? Number(storyVis.find((r) => r.visibility === visibility).count)
        : 0;

    const aiUsage = await this.usageService.getUsageStatus();

    // These values are derived from the GROUP BY aggregates above, avoiding
    // redundant COUNT(*) round-trips.
    const failedPages = Number(pageCounts?.failed) || 0;
    const processingCount = storyCountFor(StoryStatus.PROCESSING);

    return {
      users: {
        total: totalUsers,
        active: activeUsers,
        inactive: totalUsers - activeUsers,
        admins: countByRole(UserRole.ADMIN),
        managers: countByRole(UserRole.MANAGER),
        consumers: countByRole(UserRole.USER),
      },
      stories: {
        total: totalStories,
        byStatus: {
          draft: storyCountFor(StoryStatus.DRAFT),
          processing: storyCountFor(StoryStatus.PROCESSING),
          ready: storyCountFor(StoryStatus.READY),
          failed: storyCountFor(StoryStatus.FAILED),
        },
        byVisibility: {
          public: visCountFor(StoryVisibility.PUBLIC),
          private: visCountFor(StoryVisibility.PRIVATE),
          shared: visCountFor(StoryVisibility.SHARED),
        },
      },
      generations: {
        inFlightStories: processingCount,
        pageCounts: {
          total: Number(pageCounts?.total) || 0,
          completed: Number(pageCounts?.completed) || 0,
          failed: Number(pageCounts?.failed) || 0,
          inFlight: Number(pageCounts?.inFlight) || 0,
        },
        failedPages,
      },
      aiUsage: {
        used: aiUsage.used,
        limit: aiUsage.limit,
        remaining: aiUsage.remaining,
        percentage: aiUsage.percentage,
        blocked: aiUsage.blocked,
      },
      recentUsers: recentUsers.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        isActive: u.isActive,
        createdAt: u.createdAt,
      })),
    };
  }
}
