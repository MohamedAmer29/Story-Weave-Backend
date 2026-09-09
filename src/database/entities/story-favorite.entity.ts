import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Story } from './story.entity';
import { User } from './user.entity';

@Entity('story_favorites')
@Unique(['storyId', 'userId'])
export class StoryFavorite {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_favorites_story_id')
  @Column()
  storyId: string;

  @Index('IDX_favorites_user_id')
  @Column()
  userId: string;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => Story)
  @JoinColumn({ name: 'storyId' })
  story: Story;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;
}