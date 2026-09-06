import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Add the missing MODERN_GLOBAL civilization to the Postgres enum.
 *
 * This is intentionally additive so it is safe for existing data and can be
 * applied in environments where the enum was created before the frontend and
 * backend registry were fully aligned.
 */
export class AddModernGlobalCivilization1741000000001 implements MigrationInterface {
  name = 'AddModernGlobalCivilization1741000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "stories_civilization_enum" ADD VALUE IF NOT EXISTS 'MODERN_GLOBAL'`,
    );
  }

  public async down(): Promise<void> {
    // PostgreSQL enums do not support dropping individual values without
    // recreating the type, so this migration is intentionally irreversible.
  }
}
