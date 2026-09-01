import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Story } from '../../../database/entities/story.entity';
import { StoryShare } from '../../../database/entities/story-share.entity';
import { StoryVisibility } from '../../../common/enums/story-visibility.enum';

@Injectable()
export class StoryAccessService {
  constructor(
    @InjectRepository(Story)
    private readonly storyRepository: Repository<Story>,
    @InjectRepository(StoryShare)
    private readonly storyShareRepository: Repository<StoryShare>,
  ) {}

  async canAccessStory(
    storyId: string,
    userId?: string,
  ): Promise<{ story: Story; canAccess: boolean }> {
    const story = await this.storyRepository.findOne({
      where: { id: storyId },
    });

    if (!story) {
      throw new NotFoundException('Story not found');
    }

    // Guest access (no userId)
    if (!userId) {
      return {
        story,
        canAccess: story.visibility === StoryVisibility.PUBLIC,
      };
    }

    // Owner always has access
    if (story.userId === userId) {
      return { story, canAccess: true };
    }

    // Check visibility
    switch (story.visibility) {
      case StoryVisibility.PUBLIC:
        return { story, canAccess: true };

      case StoryVisibility.PRIVATE:
        return { story, canAccess: false };

      case StoryVisibility.SHARED:
        const share = await this.storyShareRepository.findOne({
          where: { storyId, userId },
        });
        return { story, canAccess: !!share };

      default:
        return { story, canAccess: false };
    }
  }

  async requireAccess(storyId: string, userId?: string): Promise<Story> {
    const { story, canAccess } = await this.canAccessStory(storyId, userId);

    if (!canAccess) {
      throw new ForbiddenException('Access denied');
    }

    return story;
  }

  async requireOwnership(storyId: string, userId: string): Promise<Story> {
    const story = await this.storyRepository.findOne({
      where: { id: storyId },
    });

    if (!story) {
      throw new NotFoundException('Story not found');
    }

    if (story.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return story;
  }
}
