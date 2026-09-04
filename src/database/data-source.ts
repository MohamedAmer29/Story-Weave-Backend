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
import { InitialSchema1720000000000 } from './migrations/1720000000000-initial-schema';
import { StoryContext1739990000000 } from './migrations/1739990000000-story-context';

const sslEnabled = process.env.DATABASE_SSL === 'true';

export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL || undefined,
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5432', 10),
  username: process.env.DATABASE_USERNAME || 'postgres',
  password: process.env.DATABASE_PASSWORD || 'postgres',
  database: process.env.DATABASE_NAME || 'ai_stories',
  // Neon requires SSL. When DATABASE_URL carries sslmode=require the driver handles it;
  // explicit DATABASE_SSL covers host/port-based connections.
  ssl: sslEnabled
    ? {
        rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false',
      }
    : undefined,
  entities: [
    User,
    Story,
    StoryPage,
    StoryShare,
    RefreshToken,
    Notification,
    AuditLog,
  ],
  migrations: [InitialSchema1720000000000, StoryContext1739990000000],
  synchronize: false,
  logging: false,
});
