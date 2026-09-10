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
import { StoryGenre } from './entities/story-genre.entity';
import { StoryEraOption } from './entities/story-era.entity';
import { StoryCivilizationOption } from './entities/story-civilization.entity';
import { InitialSchema1720000000000 } from './migrations/1720000000000-initial-schema';
import { StoryContext1739990000000 } from './migrations/1739990000000-story-context';
import { StoryCivilizationsExpansion1741000000000 } from './migrations/1741000000000-story-civilizations-expansion';
import { AddModernGlobalCivilization1741000000001 } from './migrations/1741000000001-add-modern-global-civilization';
import { AuditLogExpansion1741000000001 } from './migrations/1741000000001-audit-log-expansion';
import { AddAuthorRole1750000000000 } from './migrations/1750000000000-add-author-role';
import { ReplaceManagerWithAuthorRole1750000000001 } from './migrations/1750000000001-replace-manager-with-author-role';
import { MiddleEarthFantasy1750000000002 } from './migrations/1750000000002-middle-earth-fantasy';
import { StoryOptions1750000000003 } from './migrations/1750000000003-story-options';
import { SeedCivilizationsCatalog1750000000004 } from './migrations/1750000000004-seed-civilizations-catalog';
import { AddFourthAgeMiddleEarthEra1750000000005 } from './migrations/1750000000005-add-fourth-age-middle-earth-era';
import { AddStoryFavorites1750000000006 } from './migrations/1750000000006-add-story-favorites';
import { AddMembersVisibility1750000000007 } from './migrations/1750000000007-add-members-visibility';
import { StoryFavorite } from './entities/story-favorite.entity';

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
        rejectUnauthorized:
          process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false',
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
    StoryGenre,
    StoryEraOption,
    StoryCivilizationOption,
    StoryFavorite,
  ],
  migrations: [
    InitialSchema1720000000000,
    StoryContext1739990000000,
    StoryCivilizationsExpansion1741000000000,
    AddModernGlobalCivilization1741000000001,
    AuditLogExpansion1741000000001,
    AddAuthorRole1750000000000,
    ReplaceManagerWithAuthorRole1750000000001,
    MiddleEarthFantasy1750000000002,
    StoryOptions1750000000003,
    SeedCivilizationsCatalog1750000000004,
    AddFourthAgeMiddleEarthEra1750000000005,
    AddStoryFavorites1750000000006,
    AddMembersVisibility1750000000007,
  ],
  synchronize: false,
  logging: false,
});
