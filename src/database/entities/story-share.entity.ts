import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
  Index,
} from 'typeorm';
import { Story } from './story.entity';
import { User } from './user.entity';

@Entity('story_shares')
@Unique(['storyId', 'userId'])
export class StoryShare {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_shares_story_id')
  @Column()
  storyId: string;

  @Index('IDX_shares_user_id')
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
