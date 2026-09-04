import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Add Story Context columns (era, year, location, civilization, theme and the
 * CUSTOM free-text companions) to the `stories` table.
 *
 * The columns are nullable/enum-with-default so that existing rows are backfilled
 * with safe UNSPECIFIED/default values and do not require regeneration.
 */
export class StoryContext1739990000000 implements MigrationInterface {
  name = 'StoryContext1739990000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."stories_era_enum" AS ENUM('BCE', 'CE', 'MODERN', 'UNSPECIFIED')`,
    );
    await queryRunner.query(
      `ALTER TABLE "stories" ADD "era" "public"."stories_era_enum" NOT NULL DEFAULT 'UNSPECIFIED'`,
    );
    await queryRunner.query(`ALTER TABLE "stories" ADD "year" integer`);

    await queryRunner.query(`ALTER TABLE "stories" ADD "location" text`);

    await queryRunner.query(
      `CREATE TYPE "public"."stories_civilization_enum" AS ENUM('ARABIC', 'EGYPTIAN', 'ANCIENT_EGYPTIAN', 'GREEK', 'ROMAN', 'CUSTOM', 'UNSPECIFIED')`,
    );
    await queryRunner.query(
      `ALTER TABLE "stories" ADD "civilization" "public"."stories_civilization_enum" NOT NULL DEFAULT 'UNSPECIFIED'`,
    );
    await queryRunner.query(`ALTER TABLE "stories" ADD "customCivilization" text`);

    await queryRunner.query(
      `CREATE TYPE "public"."stories_theme_enum" AS ENUM('FANTASY', 'HISTORICAL', 'ADVENTURE', 'ROMANCE', 'MYSTERY', 'WAR', 'HORROR', 'COMEDY', 'DRAMA', 'MYTHOLOGY', 'RELIGIOUS', 'CUSTOM', 'UNSPECIFIED')`,
    );
    await queryRunner.query(
      `ALTER TABLE "stories" ADD "theme" "public"."stories_theme_enum" NOT NULL DEFAULT 'UNSPECIFIED'`,
    );
    await queryRunner.query(`ALTER TABLE "stories" ADD "customTheme" text`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "stories" DROP COLUMN "customTheme"`);
    await queryRunner.query(`ALTER TABLE "stories" DROP COLUMN "theme"`);
    await queryRunner.query(`DROP TYPE "public"."stories_theme_enum"`);
    await queryRunner.query(
      `ALTER TABLE "stories" DROP COLUMN "customCivilization"`,
    );
    await queryRunner.query(`ALTER TABLE "stories" DROP COLUMN "civilization"`);
    await queryRunner.query(`DROP TYPE "public"."stories_civilization_enum"`);
    await queryRunner.query(`ALTER TABLE "stories" DROP COLUMN "location"`);
    await queryRunner.query(`ALTER TABLE "stories" DROP COLUMN "year"`);
    await queryRunner.query(`ALTER TABLE "stories" DROP COLUMN "era"`);
    await queryRunner.query(`DROP TYPE "public"."stories_era_enum"`);
  }
}
