import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Notification } from './notification.entity';
import { Story } from '../database/entities/story.entity';
import { StoryShare } from '../database/entities/story-share.entity';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { StoryProgressService } from './story-progress.service';
import { StoryProgressGateway } from './story-progress.gateway';
import { NotificationCleanupService } from './notification-cleanup.service';
import { StoryAccessService } from '../modules/story/services/story-access.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Notification, Story, StoryShare]),
    JwtModule.registerAsync({
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('jwt.secret'),
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    StoryProgressService,
    StoryProgressGateway,
    NotificationCleanupService,
    StoryAccessService,
  ],
  exports: [
    NotificationsService,
    StoryProgressService,
    StoryAccessService,
    NotificationCleanupService,
  ],
})
export class NotificationsModule {}
