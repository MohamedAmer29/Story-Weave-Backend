import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Add Middle-earth / Hobbit / Lord of the Rings fantasy support to the story
 * context enums: the Ages (era), Middle-earth civilizations, the Middle-earth
 * genre set (story type) and the extra themes.
 *
 * - Purely additive: existing stored values are preserved and never renamed or
 *   removed, so old stories keep working unchanged.
 * - Uses ADD VALUE IF NOT EXISTS, so it is idempotent against both production
 *   (synchronize disabled) and environments that already applied it.
 * - Postgres 12+ allows ALTER TYPE ... ADD VALUE inside a transaction; the new
 *   values are only usable after commit, and this migration only executes DDL.
 * - Down migration intentionally no-ops: PostgreSQL has no DROP VALUE for
 *   enum types without recreating the type.
 */
export class MiddleEarthFantasy1750000000002 implements MigrationInterface {
  name = 'MiddleEarthFantasy1750000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DO $$ BEGIN
         ALTER TYPE "stories_era_enum" ADD VALUE IF NOT EXISTS 'FIRST_AGE';
         ALTER TYPE "stories_era_enum" ADD VALUE IF NOT EXISTS 'SECOND_AGE';
         ALTER TYPE "stories_era_enum" ADD VALUE IF NOT EXISTS 'THIRD_AGE';
         ALTER TYPE "stories_era_enum" ADD VALUE IF NOT EXISTS 'FOURTH_AGE';
       EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
    );
    await queryRunner.query(
      `DO $$ BEGIN
         ALTER TYPE "stories_civilization_enum" ADD VALUE IF NOT EXISTS 'MIDDLE_EARTH';
         ALTER TYPE "stories_civilization_enum" ADD VALUE IF NOT EXISTS 'HOBBIT';
         ALTER TYPE "stories_civilization_enum" ADD VALUE IF NOT EXISTS 'GONDOR';
         ALTER TYPE "stories_civilization_enum" ADD VALUE IF NOT EXISTS 'ROHAN';
         ALTER TYPE "stories_civilization_enum" ADD VALUE IF NOT EXISTS 'MORDOR';
         ALTER TYPE "stories_civilization_enum" ADD VALUE IF NOT EXISTS 'ELVEN_MIDDLE_EARTH';
         ALTER TYPE "stories_civilization_enum" ADD VALUE IF NOT EXISTS 'DWARVEN_MIDDLE_EARTH';
         ALTER TYPE "stories_civilization_enum" ADD VALUE IF NOT EXISTS 'ISENGARD';
         ALTER TYPE "stories_civilization_enum" ADD VALUE IF NOT EXISTS 'NUMENOREAN';
         ALTER TYPE "stories_civilization_enum" ADD VALUE IF NOT EXISTS 'GONDORIAN';
         ALTER TYPE "stories_civilization_enum" ADD VALUE IF NOT EXISTS 'ROHIRRIM';
         ALTER TYPE "stories_civilization_enum" ADD VALUE IF NOT EXISTS 'ORC_MIDDLE_EARTH';
         ALTER TYPE "stories_civilization_enum" ADD VALUE IF NOT EXISTS 'URUK_HAI';
         ALTER TYPE "stories_civilization_enum" ADD VALUE IF NOT EXISTS 'OTHER_MIDDLE_EARTH';
         ALTER TYPE "stories_civilization_enum" ADD VALUE IF NOT EXISTS 'CUSTOM_MIDDLE_EARTH';
       EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
    );
    await queryRunner.query(
      `DO $$ BEGIN
         ALTER TYPE "stories_storytype_enum" ADD VALUE IF NOT EXISTS 'LORD_OF_THE_RINGS';
         ALTER TYPE "stories_storytype_enum" ADD VALUE IF NOT EXISTS 'MIDDLE_EARTH_FANTASY';
         ALTER TYPE "stories_storytype_enum" ADD VALUE IF NOT EXISTS 'HOBBIT_FANTASY';
         ALTER TYPE "stories_storytype_enum" ADD VALUE IF NOT EXISTS 'EPIC_FANTASY';
         ALTER TYPE "stories_storytype_enum" ADD VALUE IF NOT EXISTS 'HIGH_FANTASY';
         ALTER TYPE "stories_storytype_enum" ADD VALUE IF NOT EXISTS 'DARK_FANTASY';
       EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
    );
    await queryRunner.query(
      `DO $$ BEGIN
         ALTER TYPE "stories_theme_enum" ADD VALUE IF NOT EXISTS 'EPIC_ADVENTURE';
         ALTER TYPE "stories_theme_enum" ADD VALUE IF NOT EXISTS 'HEROIC_FANTASY';
         ALTER TYPE "stories_theme_enum" ADD VALUE IF NOT EXISTS 'MYTHIC_ADVENTURE';
         ALTER TYPE "stories_theme_enum" ADD VALUE IF NOT EXISTS 'DARK_ADVENTURE';
       EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
    );
  }

  public async down(): Promise<void> {
    // No automatic down migration: PostgreSQL cannot drop enum values.
    // New values are backward compatible with all existing stored rows.
  }
}