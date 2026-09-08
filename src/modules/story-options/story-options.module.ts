import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StoryGenre } from '../../database/entities/story-genre.entity';
import { StoryEraOption } from '../../database/entities/story-era.entity';
import { StoryCivilizationOption } from '../../database/entities/story-civilization.entity';
import { StoryOptionsController } from './story-options.controller';
import { StoryOptionsService } from './story-options.service';
import { AuditLogModule } from '../../admin/audit/audit-log.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      StoryGenre,
      StoryEraOption,
      StoryCivilizationOption,
    ]),
    AuditLogModule,
  ],
  controllers: [StoryOptionsController],
  providers: [StoryOptionsService],
  exports: [StoryOptionsService],
})
export class StoryOptionsModule {}
