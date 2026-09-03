import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { User } from '../database/entities/user.entity';
import { Story } from '../database/entities/story.entity';
import { StoryPage } from '../database/entities/story-page.entity';
import { StoryShare } from '../database/entities/story-share.entity';
import { Notification } from '../notifications/notification.entity';
import { AuditLog } from './entities/audit-log.entity';
import { AuditLogService } from './audit/audit-log.service';
import { AuditInterceptor } from './audit/audit.interceptor';
import { AdminDashboardService } from './services/admin-dashboard.service';
import { AdminUsersService } from './services/admin-users.service';
import { AdminStoriesService } from './services/admin-stories.service';
import { AdminSystemService } from './services/admin-system.service';
import { IllustrationStatusService } from '../illustration/services/illustration-status.service';
import { AiUsageService } from '../ai/ai-usage.service';
import { ILLUSTRATION_QUEUE } from '../illustration/illustration.constants';
import { BULLMQ_CONNECTION } from '../bullmq/bullmq.constants';
import { AdminDashboardController } from './controllers/admin-dashboard.controller';
import { AdminUsersController } from './controllers/admin-users.controller';
import { AdminStoriesController } from './controllers/admin-stories.controller';
import { AdminSystemController } from './controllers/admin-system.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Story,
      StoryPage,
      StoryShare,
      Notification,
      AuditLog,
    ]),
  ],
  controllers: [
    AdminDashboardController,
    AdminUsersController,
    AdminStoriesController,
    AdminSystemController,
  ],
  providers: [
    AdminDashboardService,
    AdminUsersService,
    AdminStoriesService,
    AdminSystemService,
    AuditLogService,
    AuditInterceptor,
    IllustrationStatusService,
    AiUsageService,
    {
      provide: ILLUSTRATION_QUEUE,
      useFactory: (connection: Redis): Queue => {
        return new Queue(ILLUSTRATION_QUEUE, {
          connection,
          defaultJobOptions: {
            removeOnComplete: {
              count: 1000,
              age: 86400, // 24 hours
            },
            removeOnFail: {
              count: 5000,
              age: 604800, // 7 days
            },
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 2000,
            },
          },
        });
      },
      inject: [BULLMQ_CONNECTION],
    },
  ],
  exports: [AuditLogService, AuditInterceptor],
})
export class AdminModule {}
