import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { Story } from './story.entity';
import { User } from './user.entity';

@Entity('story_shares')
@Unique(['storyId', 'userId'])
export class StoryShare {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  storyId: string;

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
