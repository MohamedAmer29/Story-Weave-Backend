import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

dotenv.config({ path: ['.env.local', '.env'] });

import { User } from './entities/user.entity';
import { Story } from './entities/story.entity';
import { StoryPage } from './entities/story-page.entity';
import { StoryShare } from './entities/story-share.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { Notification } from '../notifications/notification.entity';
import { AuditLog } from '../admin/entities/audit-log.entity';
import { StoryContext1739990000000 } from './migrations/1739990000000-story-context';

export default new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5432', 10),
  username: process.env.DATABASE_USERNAME || 'postgres',
  password: process.env.DATABASE_PASSWORD || 'postgres',
  database: process.env.DATABASE_NAME || 'ai_stories',
  entities: [
    User,
    Story,
    StoryPage,
    StoryShare,
    RefreshToken,
    Notification,
    AuditLog,
  ],
  migrations: [StoryContext1739990000000],
  synchronize: false,
  logging: false,
});
