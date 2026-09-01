import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Queue, QueueEvents } from 'bullmq';
import { Redis } from 'ioredis';
import { Story } from '../database/entities/story.entity';
import { StoryPage } from '../database/entities/story-page.entity';
import { StoryModule } from '../modules/story/story.module';
import { AIModule } from '../modules/ai/ai.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { BullMQModule } from '../bullmq/bullmq.module';
import { BULLMQ_CONNECTION } from '../bullmq/bullmq.constants';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { ILLUSTRATION_QUEUE } from './illustration.constants';
import { IllustrationController } from './illustration.controller';
import { IllustrationService } from './illustration.service';
import { IllustrationProcessor } from './illustration.processor';
import { ScenePromptService } from './services/scene-prompt.service';
import { IllustrationStatusService } from './services/illustration-status.service';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([Story, StoryPage]),
    StoryModule,
    AIModule,
    NotificationsModule,
    BullMQModule,
    CloudinaryModule,
  ],
  controllers: [IllustrationController],
  providers: [
    IllustrationService,
    IllustrationProcessor,
    ScenePromptService,
    IllustrationStatusService,
    {
      provide: ILLUSTRATION_QUEUE,
      useFactory: (connection: Redis): Queue => {
        return new Queue(ILLUSTRATION_QUEUE, { connection });
      },
      inject: [BULLMQ_CONNECTION],
    },
    {
      provide: 'ILLUSTRATION_QUEUE_EVENTS',
      useFactory: (connection: Redis): QueueEvents => {
        return new QueueEvents(ILLUSTRATION_QUEUE, { connection });
      },
      inject: [BULLMQ_CONNECTION],
    },
  ],
  exports: [IllustrationService],
})
export class IllustrationModule {}
