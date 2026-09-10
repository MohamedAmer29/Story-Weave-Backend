import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Add MEMBERS to the stories visibility enum.
 *
 * - MEMBERS = visible to any authenticated user (guests are denied).
 * - Purely additive: existing stored values are preserved.
 * - Uses ADD VALUE IF NOT EXISTS inside a DO block, so it is idempotent.
 * - Down migration intentionally no-ops: PostgreSQL has no DROP VALUE for
 *   enum types without recreating the type.
 */
export class AddMembersVisibility1750000000007 implements MigrationInterface {
  name = 'AddMembersVisibility1750000000007';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DO $$ BEGIN
         ALTER TYPE "stories_visibility_enum" ADD VALUE IF NOT EXISTS 'MEMBERS';
       EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
    );
  }

  public async down(): Promise<void> {
    // No automatic down migration: PostgreSQL cannot drop enum values.
  }
}