import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Story } from '../../database/entities/story.entity';
import { StoryPage } from '../../database/entities/story-page.entity';
import { StoryShare } from '../../database/entities/story-share.entity';
import { StoryFavorite } from '../../database/entities/story-favorite.entity';
import { User } from '../../database/entities/user.entity';
import { Notification } from '../../notifications/notification.entity';
import { StoryController } from './story.controller';
import { StoryService } from './story.service';
import { PdfParserService } from './services/pdf-parser.service';
import { StoryParserService } from './services/story-parser.service';
import { StoryAccessService } from './services/story-access.service';
import { StoryContextService } from './services/story-context.service';
import { StoryLibraryService } from './services/story-library.service';
import { StoryFavoriteService } from './services/story-favorite.service';
import { IllustrationStatusService } from '../../illustration/services/illustration-status.service';
import { NotificationsModule } from '../../notifications/notifications.module';
import { AuditLogModule } from '../../admin/audit/audit-log.module';
import { StoryOptionsModule } from '../story-options/story-options.module';

@Module({
  imports: [
    AuditLogModule,
    TypeOrmModule.forFeature([
      Story,
      StoryPage,
      StoryShare,
      StoryFavorite,
      User,
      Notification,
    ]),
    NotificationsModule,
    StoryOptionsModule,
  ],
  controllers: [StoryController],
  providers: [
    StoryService,
    PdfParserService,
    StoryParserService,
    StoryAccessService,
    StoryContextService,
    StoryLibraryService,
    StoryFavoriteService,
    IllustrationStatusService,
  ],
  exports: [StoryService, StoryAccessService, StoryLibraryService],
})
export class StoryModule {}
