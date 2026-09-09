import { MigrationInterface, QueryRunner } from 'typeorm';
import { CIVILIZATIONS } from '../../common/constants/civilizations.constants';

export class SeedCivilizationsCatalog1750000000004 implements MigrationInterface {
  name = 'SeedCivilizationsCatalog1750000000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Pass 1: rename rows that came from the earlier seed migration to their
    // canonical catalog label, so stale names (e.g. "Arabic" for MODERN_ARABIC)
    // no longer collide with other catalog entries.
    for (const civ of CIVILIZATIONS) {
      await queryRunner.query(
        `UPDATE "story_civilizations"
         SET "name" = $2, "isActive" = true, "updatedAt" = now()
         WHERE "legacyValue" = $1 AND "name" IS DISTINCT FROM $2`,
        [civ.value, civ.label],
      );
    }

    // Pass 2: upsert the full catalog by legacyValue.
    for (const civ of CIVILIZATIONS) {
      await queryRunner.query(
        `INSERT INTO "story_civilizations" ("name", "legacyValue", "isActive")
         VALUES ($1, $2, true)
         ON CONFLICT ("legacyValue")
         DO UPDATE SET "name" = EXCLUDED."name", "isActive" = true, "updatedAt" = now()`,
        [civ.label, civ.value],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const civ of CIVILIZATIONS) {
      await queryRunner.query(
        `DELETE FROM "story_civilizations" WHERE "legacyValue" = $1`,
        [civ.value],
      );
    }
  }
}
