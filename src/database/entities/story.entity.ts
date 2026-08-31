import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { StoryStatus } from '../../common/enums/story-status.enum';
import { SourceType } from '../../common/enums/source-type.enum';
import { StoryVisibility } from '../../common/enums/story-visibility.enum';
import { User } from './user.entity';
import { StoryPage } from './story-page.entity';

@Entity('stories')
export class Story {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column()
  title: string;

  @Column({ nullable: true })
  description: string;

  @Column({ type: 'text' })
  originalText: string;

  @Column({
    type: 'enum',
    enum: SourceType,
    default: SourceType.TEXT,
  })
  sourceType: SourceType;

  @Column({
    type: 'enum',
    enum: StoryStatus,
    default: StoryStatus.DRAFT,
  })
  status: StoryStatus;

  @Column({
    type: 'enum',
    enum: StoryVisibility,
    default: StoryVisibility.PRIVATE,
  })
  visibility: StoryVisibility;

  @Column({ nullable: true })
  language: string;

  @Column({ nullable: true, type: 'text' })
  errorMessage: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => User, (user) => user.stories)
  @JoinColumn({ name: 'userId' })
  user: User;

  @OneToMany(() => StoryPage, (page) => page.story, { cascade: true })
  pages: StoryPage[];
}
