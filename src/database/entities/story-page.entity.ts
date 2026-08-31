import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { PageStatus } from '../../common/enums/page-status.enum';
import { Story } from './story.entity';

@Entity('story_pages')
export class StoryPage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  storyId: string;

  @Column()
  pageNumber: number;

  @Column({ nullable: true })
  title: string;

  @Column({ type: 'text' })
  text: string;

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

  @Column({ nullable: true })
  imageUrl: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Story, (story) => story.pages)
  @JoinColumn({ name: 'storyId' })
  story: Story;
}
