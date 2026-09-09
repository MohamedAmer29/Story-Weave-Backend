import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFourthAgeMiddleEarthEra1750000000005 implements MigrationInterface {
  name = 'AddFourthAgeMiddleEarthEra1750000000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "stories_era_enum" ADD VALUE IF NOT EXISTS 'FOURTH_AGE_OF_MIDDLE_EARTH'`,
    );
  }

  public async down(): Promise<void> {
    // PostgreSQL cannot remove a value from an enum type; nothing to revert.
  }
}
