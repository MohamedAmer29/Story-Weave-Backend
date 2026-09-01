import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Story } from '../../database/entities/story.entity';
import { StoryPage } from '../../database/entities/story-page.entity';
import { StoryShare } from '../../database/entities/story-share.entity';
import { User } from '../../database/entities/user.entity';
import { Notification } from '../../notifications/notification.entity';
import { StoryController } from './story.controller';
import { StoryService } from './story.service';
import { PdfParserService } from './services/pdf-parser.service';
import { StoryParserService } from './services/story-parser.service';
import { StoryAccessService } from './services/story-access.service';
import { StoryLibraryService } from './services/story-library.service';
import { IllustrationStatusService } from '../../illustration/services/illustration-status.service';
import { NotificationsModule } from '../../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Story,
      StoryPage,
      StoryShare,
      User,
      Notification,
    ]),
    NotificationsModule,
  ],
  controllers: [StoryController],
  providers: [
    StoryService,
    PdfParserService,
    StoryParserService,
    StoryAccessService,
    StoryLibraryService,
    IllustrationStatusService,
  ],
  exports: [StoryService, StoryAccessService, StoryLibraryService],
})
export class StoryModule {}
