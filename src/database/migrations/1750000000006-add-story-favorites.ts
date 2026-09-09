import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStoryFavorites1750000000006 implements MigrationInterface {
  name = 'AddStoryFavorites1750000000006';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "story_favorites" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "storyId" uuid NOT NULL, "userId" uuid NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_story_favorites_story_user" UNIQUE ("storyId", "userId"), CONSTRAINT "PK_story_favorites" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_favorites_story_id" ON "story_favorites"  ("storyId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_favorites_user_id" ON "story_favorites"  ("userId") `,
    );
    await queryRunner.query(
      `ALTER TABLE "story_favorites" ADD CONSTRAINT "FK_favorites_story" FOREIGN KEY ("storyId") REFERENCES "stories"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "story_favorites" ADD CONSTRAINT "FK_favorites_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "story_favorites" DROP CONSTRAINT "FK_favorites_user"`,
    );
    await queryRunner.query(
      `ALTER TABLE "story_favorites" DROP CONSTRAINT "FK_favorites_story"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_favorites_user_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_favorites_story_id"`);
    await queryRunner.query(`DROP TABLE "story_favorites"`);
  }
}