import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { StoryStatus } from '../../common/enums/story-status.enum';
import { SourceType } from '../../common/enums/source-type.enum';
import { StoryVisibility } from '../../common/enums/story-visibility.enum';
import { StoryIllustrationStatus } from '../../illustration/enums/story-illustration-status.enum';
import { User } from './user.entity';
import { StoryPage } from './story-page.entity';

@Entity('stories')
@Index('IDX_stories_user_visibility', ['userId', 'visibility'])
@Index('IDX_stories_user_status', ['userId', 'status'])
export class Story {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_stories_user_id')
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

  @Index('IDX_stories_status')
  @Column({
    type: 'enum',
    enum: StoryStatus,
    default: StoryStatus.DRAFT,
  })
  status: StoryStatus;

  @Index('IDX_stories_visibility')
  @Column({
    type: 'enum',
    enum: StoryVisibility,
    default: StoryVisibility.PRIVATE,
  })
  visibility: StoryVisibility;

  @Column({ nullable: true })
  language: string;

  @Column({ nullable: true, type: 'text' })
  visualStyle: string;

  @Column({ nullable: true, type: 'text' })
  errorMessage: string;

  @Column({
    type: 'enum',
    enum: StoryIllustrationStatus,
    default: StoryIllustrationStatus.NOT_STARTED,
    nullable: true,
  })
  illustrationStatus: StoryIllustrationStatus;

  @Column({ nullable: true, type: 'timestamp' })
  illustrationGenerationNotifiedAt: Date | null;

  @Index('IDX_stories_created_at')
  @CreateDateColumn()
  createdAt: Date;

  @Index('IDX_stories_updated_at')
  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => User, (user) => user.stories)
  @JoinColumn({ name: 'userId' })
  user: User;

  @OneToMany(() => StoryPage, (page) => page.story, { cascade: true })
  pages: StoryPage[];
}
