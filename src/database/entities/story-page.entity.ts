import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { PageStatus } from '../../common/enums/page-status.enum';
import { IllustrationPageStatus } from '../../illustration/enums/illustration-page-status.enum';
import { Story } from './story.entity';

@Entity('story_pages')
@Index('IDX_pages_story_image_status', ['storyId', 'imageStatus'])
export class StoryPage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_pages_story_id')
  @Column()
  storyId: string;

  @Column()
  pageNumber: number;

  @Column({ nullable: true })
  title: string;

  @Column({ type: 'text' })
  text: string;

  @Column({ type: 'int', nullable: true })
  wordCount: number | null;

  @Column({ nullable: true, type: 'text' })
  sceneDescription: string;

  @Column({ nullable: true, type: 'text' })
  characterDescriptions: string;

  @Column({ nullable: true })
  location: string;

  @Column({ nullable: true, type: 'text' })
  imagePrompt: string;

  @Column({
    type: 'enum',
    enum: PageStatus,
    default: PageStatus.DRAFT,
  })
  status: PageStatus;

  @Column({ nullable: true, type: 'varchar' })
  imageUrl: string | null;

  @Column({ nullable: true, type: 'varchar' })
  imagePublicId: string | null;

  @Column({
    type: 'enum',
    enum: IllustrationPageStatus,
    default: IllustrationPageStatus.PENDING,
    nullable: true,
  })
  imageStatus: IllustrationPageStatus | null;

  @Column({ nullable: true, type: 'text' })
  imageError: string | null;

  @Column({ nullable: true, type: 'timestamp' })
  imageGeneratedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Story, (story) => story.pages)
  @JoinColumn({ name: 'storyId' })
  story: Story;
}
