import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StoryFavorite } from '../../../database/entities/story-favorite.entity';
import { Story } from '../../../database/entities/story.entity';
import { StoryAccessService } from './story-access.service';

@Injectable()
export class StoryFavoriteService {
  constructor(
    @InjectRepository(StoryFavorite)
    private readonly favoriteRepository: Repository<StoryFavorite>,
    @InjectRepository(Story)
    private readonly storyRepository: Repository<Story>,
    private readonly storyAccessService: StoryAccessService,
  ) {}

  async isFavorited(userId: string, storyId: string): Promise<boolean> {
    const favorite = await this.favoriteRepository.findOne({
      where: { userId, storyId },
    });
    return Boolean(favorite);
  }

  async add(userId: string, storyId: string): Promise<{ favorited: boolean }> {
    const story = await this.storyRepository.findOne({
      where: { id: storyId },
    });
    if (!story) {
      throw new NotFoundException('Story not found');
    }
    await this.storyAccessService.requireAccess(storyId, userId);

    const existing = await this.favoriteRepository.findOne({
      where: { userId, storyId },
    });
    if (!existing) {
      await this.favoriteRepository.insert({ userId, storyId });
    }
    return { favorited: true };
  }

  async remove(
    userId: string,
    storyId: string,
  ): Promise<{ favorited: boolean }> {
    await this.favoriteRepository.delete({ userId, storyId });
    return { favorited: false };
  }
}