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
import { StoryType } from '../../common/enums/story-type.enum';
import { StoryLanguage } from '../../common/enums/story-language.enum';
import { StoryIllustrationStatus } from '../../illustration/enums/story-illustration-status.enum';
import { IllustrationPageStatus } from '../../illustration/enums/illustration-page-status.enum';
import { GenerationStatus } from '../../common/enums/generation-status.enum';
import { User } from './user.entity';
import { StoryPage } from './story-page.entity';
import { StoryShare } from './story-share.entity';

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

  @Index('IDX_stories_story_type')
  @Column({
    type: 'enum',
    enum: StoryType,
    nullable: true,
  })
  storyType: StoryType | null;

  @Column({ nullable: true, type: 'text' })
  visualStyle: string;

  @Column({
    type: 'enum',
    enum: GenerationStatus,
    nullable: true,
  })
  generationStatus?: GenerationStatus;

  @Column({ nullable: true })
  coverImageUrl?: string;

  @Column({
    type: 'enum',
    enum: StoryLanguage,
    nullable: true,
  })
  language: StoryLanguage | null;

  @Column({ nullable: true, type: 'text' })
  errorMessage: string;

  @Column({ nullable: true, type: 'int', default: 0 })
  totalImages?: number;

  @Column({ nullable: true, type: 'int', default: 0 })
  completedImages?: number;

  @Column({ nullable: true, type: 'int', default: 0 })
  failedImages?: number;

  @Column({
    type: 'enum',
    enum: StoryIllustrationStatus,
    default: StoryIllustrationStatus.NOT_STARTED,
    nullable: true,
  })
  illustrationStatus: StoryIllustrationStatus;

  @Column({ nullable: true, type: 'timestamp' })
  illustrationGenerationNotifiedAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  illustrationGenerationAttemptId: string | null;

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

  @OneToMany(() => StoryShare, (share) => share.story)
  shares: StoryShare[];

  @Column({ nullable: true, type: 'text' })
  coverImagePublicId: string | null;

  @Column({ nullable: true, type: 'text' })
  coverImagePrompt: string | null;

  @Column({
    type: 'enum',
    enum: IllustrationPageStatus,
    default: IllustrationPageStatus.PENDING,
    nullable: true,
  })
  coverImageStatus: IllustrationPageStatus | null;

  @Column({ nullable: true, type: 'text' })
  coverImageError: string | null;

  @Column({ nullable: true, type: 'timestamp' })
  coverImageGeneratedAt: Date | null;
}
