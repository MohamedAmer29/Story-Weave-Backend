import { MigrationInterface, QueryRunner } from 'typeorm';

const GENRE_SEEDS: Array<{ name: string; legacyValue: string | null }> = [
  { name: 'Fantasy', legacyValue: 'FANTASY' },
  { name: 'Adventure', legacyValue: 'ADVENTURE' },
  { name: 'Science Fiction', legacyValue: 'SCI_FI' },
  { name: 'Mystery', legacyValue: 'MYSTERY' },
  { name: 'Horror', legacyValue: 'HORROR' },
  { name: 'Romance', legacyValue: 'ROMANCE' },
  { name: 'Comedy', legacyValue: 'COMEDY' },
  { name: 'Drama', legacyValue: 'DRAMA' },
  { name: 'Historical', legacyValue: 'HISTORICAL' },
  { name: 'Fairy Tale', legacyValue: 'FAIRY_TALE' },
  { name: 'Children', legacyValue: 'CHILDREN' },
  { name: 'Action', legacyValue: 'ACTION' },
  { name: 'Thriller', legacyValue: 'THRILLER' },
  { name: 'Lord of the Rings', legacyValue: 'LORD_OF_THE_RINGS' },
  { name: 'Middle-earth Fantasy', legacyValue: 'MIDDLE_EARTH_FANTASY' },
  { name: 'Hobbit Fantasy', legacyValue: 'HOBBIT_FANTASY' },
  { name: 'Epic Fantasy', legacyValue: 'EPIC_FANTASY' },
  { name: 'High Fantasy', legacyValue: 'HIGH_FANTASY' },
  { name: 'Dark Fantasy', legacyValue: 'DARK_FANTASY' },
  { name: 'Historical Fiction', legacyValue: null },
  { name: 'Mythology', legacyValue: null },
];

const ERA_SEEDS: Array<{ name: string; legacyValue: string | null }> = [
  { name: 'Before Common Era', legacyValue: 'BCE' },
  { name: 'Common Era', legacyValue: 'CE' },
  { name: 'Modern', legacyValue: 'MODERN' },
  { name: 'First Age', legacyValue: 'FIRST_AGE' },
  { name: 'Second Age', legacyValue: 'SECOND_AGE' },
  { name: 'Third Age', legacyValue: 'THIRD_AGE' },
  { name: 'Fourth Age', legacyValue: 'FOURTH_AGE' },
  { name: 'Unspecified', legacyValue: 'UNSPECIFIED' },
  { name: 'Ancient', legacyValue: null },
  { name: 'Medieval', legacyValue: null },
  { name: 'Renaissance', legacyValue: null },
  { name: 'Industrial', legacyValue: null },
];

const CIVILIZATION_SEEDS: Array<{ name: string; legacyValue: string }> = [
  { name: 'Ancient Egyptian', legacyValue: 'ANCIENT_EGYPTIAN' },
  { name: 'Ancient Greek', legacyValue: 'ANCIENT_GREEK' },
  { name: 'Roman', legacyValue: 'ROMAN' },
  { name: 'Persian', legacyValue: 'PERSIAN' },
  { name: 'Mayan', legacyValue: 'MAYA' },
  { name: 'Aztec', legacyValue: 'AZTEC_MEXICA' },
  { name: 'Medieval European', legacyValue: 'MEDIEVAL_ENGLISH' },
  { name: 'Viking / Norse', legacyValue: 'VIKING_NORSE' },
  { name: 'Middle-earth', legacyValue: 'MIDDLE_EARTH' },
  { name: 'Gondor', legacyValue: 'GONDOR' },
  { name: 'Rohan', legacyValue: 'ROHAN' },
  { name: 'Mordor', legacyValue: 'MORDOR' },
  { name: 'Elven / Middle-earth', legacyValue: 'ELVEN_MIDDLE_EARTH' },
  { name: 'Dwarven / Middle-earth', legacyValue: 'DWARVEN_MIDDLE_EARTH' },
  { name: 'Japanese', legacyValue: 'MODERN_JAPANESE' },
  { name: 'Chinese', legacyValue: 'MODERN_CHINESE' },
  { name: 'Indian', legacyValue: 'MODERN_INDIAN' },
  { name: 'Greek', legacyValue: 'MODERN_GREEK' },
  { name: 'Arabic', legacyValue: 'MODERN_ARABIC' },
  { name: 'African', legacyValue: 'MODERN_AFRICAN' },
  { name: 'Native American', legacyValue: 'LAKOTA' },
  { name: 'Celtic', legacyValue: 'CELTIC' },
  { name: 'Byzantine', legacyValue: 'BYZANTINE' },
  { name: 'Inca', legacyValue: 'INCA' },
  { name: 'Mongol', legacyValue: 'MONGOL' },
  { name: 'Polynesian', legacyValue: 'POLYNESIAN' },
  { name: 'Hobbit', legacyValue: 'HOBBIT' },
];

export class StoryOptions1750000000003 implements MigrationInterface {
  name = 'StoryOptions1750000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create story_genres table
    await queryRunner.query(`
      CREATE TABLE "story_genres" (
        "id" uuid DEFAULT uuid_generate_v4(),
        "name" character varying(120) NOT NULL,
        "description" text,
        "isActive" boolean NOT NULL DEFAULT true,
        "legacyValue" character varying(120),
        "createdBy" uuid,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_story_genres_name" UNIQUE ("name"),
        CONSTRAINT "UQ_story_genres_legacyValue" UNIQUE ("legacyValue"),
        CONSTRAINT "PK_story_genres" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_story_genres_active" ON "story_genres" ("isActive")`,
    );

    // Create story_eras table
    await queryRunner.query(`
      CREATE TABLE "story_eras" (
        "id" uuid DEFAULT uuid_generate_v4(),
        "name" character varying(120) NOT NULL,
        "description" text,
        "isActive" boolean NOT NULL DEFAULT true,
        "legacyValue" character varying(120),
        "createdBy" uuid,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_story_eras_name" UNIQUE ("name"),
        CONSTRAINT "UQ_story_eras_legacyValue" UNIQUE ("legacyValue"),
        CONSTRAINT "PK_story_eras" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_story_eras_active" ON "story_eras" ("isActive")`,
    );

    // Create story_civilizations table
    await queryRunner.query(`
      CREATE TABLE "story_civilizations" (
        "id" uuid DEFAULT uuid_generate_v4(),
        "name" character varying(200) NOT NULL,
        "description" text,
        "isActive" boolean NOT NULL DEFAULT true,
        "legacyValue" character varying(200),
        "createdBy" uuid,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_story_civilizations_name" UNIQUE ("name"),
        CONSTRAINT "UQ_story_civilizations_legacyValue" UNIQUE ("legacyValue"),
        CONSTRAINT "PK_story_civilizations" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_story_civilizations_active" ON "story_civilizations" ("isActive")`,
    );

    // Add FK columns to stories table
    await queryRunner.query(
      `ALTER TABLE "stories" ADD COLUMN "genreId" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "stories" ADD COLUMN "eraId" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "stories" ADD COLUMN "civilizationId" uuid`,
    );

    // Seed genres
    for (const genre of GENRE_SEEDS) {
      await queryRunner.query(
        `INSERT INTO "story_genres" ("name", "legacyValue", "isActive") VALUES ($1, $2, true)`,
        [genre.name, genre.legacyValue],
      );
    }

    // Seed eras
    for (const era of ERA_SEEDS) {
      await queryRunner.query(
        `INSERT INTO "story_eras" ("name", "legacyValue", "isActive") VALUES ($1, $2, true)`,
        [era.name, era.legacyValue],
      );
    }

    // Seed civilizations
    for (const civ of CIVILIZATION_SEEDS) {
      await queryRunner.query(
        `INSERT INTO "story_civilizations" ("name", "legacyValue", "isActive") VALUES ($1, $2, true)`,
        [civ.name, civ.legacyValue],
      );
    }

    // Backfill genreId from legacy storyType
    await queryRunner.query(`
      UPDATE "stories" s
      SET "genreId" = g."id"
      FROM "story_genres" g
      WHERE g."legacyValue" IS NOT NULL
        AND s."storyType"::text = g."legacyValue"
        AND s."genreId" IS NULL
    `);

    // Backfill eraId from legacy era
    await queryRunner.query(`
      UPDATE "stories" s
      SET "eraId" = e."id"
      FROM "story_eras" e
      WHERE e."legacyValue" IS NOT NULL
        AND s."era"::text = e."legacyValue"
        AND s."eraId" IS NULL
    `);

    // Backfill civilizationId from legacy civilization
    await queryRunner.query(`
      UPDATE "stories" s
      SET "civilizationId" = c."id"
      FROM "story_civilizations" c
      WHERE c."legacyValue" IS NOT NULL
        AND s."civilization"::text = c."legacyValue"
        AND s."civilizationId" IS NULL
    `);

    // Add indexes for FK columns
    await queryRunner.query(
      `CREATE INDEX "IDX_stories_genreId" ON "stories" ("genreId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_stories_eraId" ON "stories" ("eraId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_stories_civilizationId" ON "stories" ("civilizationId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove FK columns from stories table
    await queryRunner.query(`ALTER TABLE "stories" DROP COLUMN "genreId"`);
    await queryRunner.query(`ALTER TABLE "stories" DROP COLUMN "eraId"`);
    await queryRunner.query(
      `ALTER TABLE "stories" DROP COLUMN "civilizationId"`,
    );

    // Drop tables
    await queryRunner.query(`DROP TABLE "story_genres"`);
    await queryRunner.query(`DROP TABLE "story_eras"`);
    await queryRunner.query(`DROP TABLE "story_civilizations"`);
  }
}
