import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Add Story Context columns (era, year, location, civilization, theme and the
 * CUSTOM free-text companions) to the `stories` table.
 *
 * Notes:
 * - Uses `IF NOT EXISTS` guards so the migration is idempotent: it can run on a
 *   fresh production DB (synchronize disabled) AND on a dev DB where
 *   `synchronize: true` already created the same enum types/columns.
 * - Enum columns carry safe defaults (UNSPECIFIED) and the free-text columns
 *   are nullable, so existing rows are backfilled safely and never need to be
 *   regenerated.
 */
export class StoryContext1739990000000 implements MigrationInterface {
  name = 'StoryContext1739990000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DO $$ BEGIN
         CREATE TYPE "stories_era_enum" AS ENUM('BCE', 'CE', 'MODERN', 'UNSPECIFIED');
       EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    );
    await queryRunner.query(
      `ALTER TABLE "stories" ADD COLUMN IF NOT EXISTS "era" "stories_era_enum" NOT NULL DEFAULT 'UNSPECIFIED'`,
    );
    await queryRunner.query(
      `ALTER TABLE "stories" ADD COLUMN IF NOT EXISTS "year" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "stories" ADD COLUMN IF NOT EXISTS "location" text`,
    );

    await queryRunner.query(
      `DO $$ BEGIN
         CREATE TYPE "stories_civilization_enum" AS ENUM('ARABIC', 'EGYPTIAN', 'ANCIENT_EGYPTIAN', 'GREEK', 'ROMAN', 'CUSTOM', 'UNSPECIFIED');
       EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    );
    await queryRunner.query(
      `ALTER TABLE "stories" ADD COLUMN IF NOT EXISTS "civilization" "stories_civilization_enum" NOT NULL DEFAULT 'UNSPECIFIED'`,
    );
    await queryRunner.query(
      `ALTER TABLE "stories" ADD COLUMN IF NOT EXISTS "customCivilization" text`,
    );

    await queryRunner.query(
      `DO $$ BEGIN
         CREATE TYPE "stories_theme_enum" AS ENUM('FANTASY', 'HISTORICAL', 'ADVENTURE', 'ROMANCE', 'MYSTERY', 'WAR', 'HORROR', 'COMEDY', 'DRAMA', 'MYTHOLOGY', 'RELIGIOUS', 'CUSTOM', 'UNSPECIFIED');
       EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    );
    await queryRunner.query(
      `ALTER TABLE "stories" ADD COLUMN IF NOT EXISTS "theme" "stories_theme_enum" NOT NULL DEFAULT 'UNSPECIFIED'`,
    );
    await queryRunner.query(
      `ALTER TABLE "stories" ADD COLUMN IF NOT EXISTS "customTheme" text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "stories" DROP COLUMN IF EXISTS "customTheme"`,
    );
    await queryRunner.query(
      `ALTER TABLE "stories" DROP COLUMN IF EXISTS "theme"`,
    );
    await queryRunner.query(`DROP TYPE IF EXISTS "stories_theme_enum"`);
    await queryRunner.query(
      `ALTER TABLE "stories" DROP COLUMN IF EXISTS "customCivilization"`,
    );
    await queryRunner.query(
      `ALTER TABLE "stories" DROP COLUMN IF EXISTS "civilization"`,
    );
    await queryRunner.query(`DROP TYPE IF EXISTS "stories_civilization_enum"`);
    await queryRunner.query(
      `ALTER TABLE "stories" DROP COLUMN IF EXISTS "location"`,
    );
    await queryRunner.query(
      `ALTER TABLE "stories" DROP COLUMN IF EXISTS "year"`,
    );
    await queryRunner.query(
      `ALTER TABLE "stories" DROP COLUMN IF EXISTS "era"`,
    );
    await queryRunner.query(`DROP TYPE IF EXISTS "stories_era_enum"`);
  }
}
