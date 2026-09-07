import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAuthorRole1750000000000 implements MigrationInterface {
  name = 'AddAuthorRole1750000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."users_role_enum" ADD VALUE IF NOT EXISTS 'AUTHOR'`,
    );
  }

  public async down(): Promise<void> {
    // PostgreSQL does not support removing an enum value safely in place.
  }
}
