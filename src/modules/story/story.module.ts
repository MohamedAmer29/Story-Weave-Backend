import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Story } from '../../database/entities/story.entity';
import { StoryPage } from '../../database/entities/story-page.entity';
import { StoryShare } from '../../database/entities/story-share.entity';
import { StoryController } from './story.controller';
import { StoryService } from './story.service';
import { PdfParserService } from './services/pdf-parser.service';
import { StoryParserService } from './services/story-parser.service';

@Module({
  imports: [TypeOrmModule.forFeature([Story, StoryPage, StoryShare])],
  controllers: [StoryController],
  providers: [StoryService, PdfParserService, StoryParserService],
  exports: [StoryService],
})
export class StoryModule {}
