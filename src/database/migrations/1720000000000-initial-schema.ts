import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1720000000000 implements MigrationInterface {
  name = 'InitialSchema1720000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(
      `CREATE TYPE "public"."story_pages_status_enum" AS ENUM('DRAFT', 'PROCESSING', 'READY', 'FAILED')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."story_pages_imagestatus_enum" AS ENUM('PENDING', 'QUEUED', 'GENERATING', 'UPLOADING', 'COMPLETED', 'FAILED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "story_pages" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "storyId" uuid NOT NULL, "pageNumber" integer NOT NULL, "title" character varying, "text" text NOT NULL, "wordCount" integer, "sceneDescription" text, "characterDescriptions" text, "location" character varying, "imagePrompt" text, "status" "public"."story_pages_status_enum" NOT NULL DEFAULT 'DRAFT', "imageUrl" character varying, "imagePublicId" character varying, "imageStatus" "public"."story_pages_imagestatus_enum" DEFAULT 'PENDING', "imageError" text, "imageGeneratedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_432a709517f03be108cc0e0335c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_pages_story_id" ON "story_pages"  ("storyId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_pages_story_page_number" ON "story_pages"  ("storyId", "pageNumber") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_pages_story_image_status" ON "story_pages"  ("storyId", "imageStatus") `,
    );
    await queryRunner.query(
      `CREATE TABLE "story_shares" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "storyId" uuid NOT NULL, "userId" uuid NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_55fcb06988f4e8737082069fa0e" UNIQUE ("storyId", "userId"), CONSTRAINT "PK_e9dd30aea0bbc21e06cd35a1383" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_shares_story_id" ON "story_shares"  ("storyId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_shares_user_id" ON "story_shares"  ("userId") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."stories_sourcetype_enum" AS ENUM('TEXT', 'PDF')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."stories_status_enum" AS ENUM('DRAFT', 'PROCESSING', 'READY', 'FAILED')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."stories_visibility_enum" AS ENUM('PUBLIC', 'PRIVATE', 'SHARED')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."stories_storytype_enum" AS ENUM('FANTASY', 'ADVENTURE', 'SCI_FI', 'MYSTERY', 'HORROR', 'ROMANCE', 'COMEDY', 'DRAMA', 'HISTORICAL', 'FAIRY_TALE', 'CHILDREN', 'ACTION', 'THRILLER')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."stories_era_enum" AS ENUM('BCE', 'CE', 'MODERN', 'UNSPECIFIED')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."stories_civilization_enum" AS ENUM('ARABIC', 'EGYPTIAN', 'ANCIENT_EGYPTIAN', 'GREEK', 'ROMAN', 'CUSTOM', 'UNSPECIFIED')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."stories_theme_enum" AS ENUM('FANTASY', 'HISTORICAL', 'ADVENTURE', 'ROMANCE', 'MYSTERY', 'WAR', 'HORROR', 'COMEDY', 'DRAMA', 'MYTHOLOGY', 'RELIGIOUS', 'CUSTOM', 'UNSPECIFIED')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."stories_generationstatus_enum" AS ENUM('PENDING', 'QUEUED', 'GENERATING', 'UPLOADING', 'COMPLETED', 'PARTIALLY_FAILED', 'FAILED', 'CANCELLED')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."stories_language_enum" AS ENUM('ARABIC', 'ENGLISH')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."stories_illustrationstatus_enum" AS ENUM('NOT_STARTED', 'QUEUED', 'GENERATING', 'COMPLETED', 'PARTIALLY_FAILED', 'FAILED')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."stories_coverimagestatus_enum" AS ENUM('PENDING', 'QUEUED', 'GENERATING', 'UPLOADING', 'COMPLETED', 'FAILED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "stories" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "title" character varying NOT NULL, "description" character varying, "originalText" text NOT NULL, "sourceType" "public"."stories_sourcetype_enum" NOT NULL DEFAULT 'TEXT', "status" "public"."stories_status_enum" NOT NULL DEFAULT 'DRAFT', "visibility" "public"."stories_visibility_enum" NOT NULL DEFAULT 'PRIVATE', "storyType" "public"."stories_storytype_enum", "visualStyle" text, "era" "public"."stories_era_enum" NOT NULL DEFAULT 'UNSPECIFIED', "year" integer, "location" text, "civilization" "public"."stories_civilization_enum" NOT NULL DEFAULT 'UNSPECIFIED', "customCivilization" text, "theme" "public"."stories_theme_enum" NOT NULL DEFAULT 'UNSPECIFIED', "customTheme" text, "generationStatus" "public"."stories_generationstatus_enum", "coverImageUrl" character varying, "language" "public"."stories_language_enum", "errorMessage" text, "totalImages" integer DEFAULT '0', "completedImages" integer DEFAULT '0', "failedImages" integer DEFAULT '0', "illustrationStatus" "public"."stories_illustrationstatus_enum" DEFAULT 'NOT_STARTED', "illustrationGenerationNotifiedAt" TIMESTAMP, "illustrationGenerationAttemptId" uuid, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "coverImagePublicId" text, "coverImagePrompt" text, "coverImageStatus" "public"."stories_coverimagestatus_enum" DEFAULT 'PENDING', "coverImageError" text, "coverImageGeneratedAt" TIMESTAMP, CONSTRAINT "PK_bb6f880b260ed96c452b32a39f0" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_stories_user_id" ON "stories"  ("userId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_stories_status" ON "stories"  ("status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_stories_visibility" ON "stories"  ("visibility") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_stories_story_type" ON "stories"  ("storyType") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_stories_created_at" ON "stories"  ("createdAt") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_stories_updated_at" ON "stories"  ("updatedAt") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_stories_language" ON "stories"  ("language") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_stories_user_status" ON "stories"  ("userId", "status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_stories_user_visibility" ON "stories"  ("userId", "visibility") `,
    );
    await queryRunner.query(
      `CREATE TABLE "refresh_tokens" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "token" character varying NOT NULL, "ipAddress" character varying, "userAgent" character varying, "expiresAt" TIMESTAMP NOT NULL, "revokedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "lastUsedAt" TIMESTAMP, CONSTRAINT "PK_7d8bee0204106019488c4c50ffa" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_refresh_tokens_token" ON "refresh_tokens"  ("token") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_refresh_tokens_user_id" ON "refresh_tokens"  ("userId") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."users_role_enum" AS ENUM('USER', 'ADMIN', 'MANAGER')`,
    );
    await queryRunner.query(
      `CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying NOT NULL, "password" character varying NOT NULL, "firstName" character varying NOT NULL, "lastName" character varying NOT NULL, "name" character varying, "role" "public"."users_role_enum" NOT NULL DEFAULT 'USER', "isActive" boolean NOT NULL DEFAULT true, "emailVerified" boolean NOT NULL DEFAULT false, "tokenVersion" integer NOT NULL DEFAULT '0', "avatarUrl" character varying, "avatarPublicId" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_users_created_at" ON "users"  ("createdAt") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_users_role" ON "users"  ("role") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_users_email" ON "users"  ("email") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."notifications_type_enum" AS ENUM('STORY_GENERATION_STARTED', 'STORY_PAGE_COMPLETED', 'STORY_GENERATION_COMPLETED', 'STORY_GENERATION_PARTIALLY_FAILED', 'STORY_GENERATION_FAILED', 'AI_DAILY_LIMIT_REACHED', 'STORY_SHARED', 'STORY_ACCESS_REMOVED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "notifications" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" character varying NOT NULL, "type" "public"."notifications_type_enum" NOT NULL, "title" character varying NOT NULL, "message" text, "data" jsonb, "isRead" boolean NOT NULL DEFAULT false, "readAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_6a72c3c0f683f6462415e653c3a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_notifications_user_id" ON "notifications"  ("userId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_notifications_is_read" ON "notifications"  ("isRead") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_notifications_created_at" ON "notifications"  ("createdAt") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_notifications_user_read" ON "notifications"  ("userId", "isRead") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_notifications_user_created" ON "notifications"  ("userId", "createdAt") `,
    );
    await queryRunner.query(
      `CREATE TABLE "audit_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "adminId" character varying NOT NULL, "adminEmail" character varying, "action" character varying NOT NULL, "targetType" character varying, "targetId" character varying, "metadata" jsonb, "ip" character varying, "userAgent" character varying(255), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_1bb179d048bbc581caa3b013439" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_audit_admin_id" ON "audit_logs"  ("adminId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_audit_created_at" ON "audit_logs"  ("createdAt") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_audit_target_id" ON "audit_logs"  ("targetId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_audit_target_type" ON "audit_logs"  ("targetType") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_audit_action" ON "audit_logs"  ("action") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_audit_admin_created" ON "audit_logs"  ("adminId", "createdAt") `,
    );
    await queryRunner.query(
      `ALTER TABLE "story_pages" ADD CONSTRAINT "FK_05b21c488dcc4b53a40a1414cda" FOREIGN KEY ("storyId") REFERENCES "stories"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "story_shares" ADD CONSTRAINT "FK_645d408c2a4052eefda29aa09b4" FOREIGN KEY ("storyId") REFERENCES "stories"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "story_shares" ADD CONSTRAINT "FK_c26983bdcaa5e839f9b3061e2ac" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "stories" ADD CONSTRAINT "FK_655cd324a6949f46e1b397f621e" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" ADD CONSTRAINT "FK_610102b60fea1455310ccd299de" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" DROP CONSTRAINT "FK_610102b60fea1455310ccd299de"`,
    );
    await queryRunner.query(
      `ALTER TABLE "stories" DROP CONSTRAINT "FK_655cd324a6949f46e1b397f621e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "story_shares" DROP CONSTRAINT "FK_c26983bdcaa5e839f9b3061e2ac"`,
    );
    await queryRunner.query(
      `ALTER TABLE "story_shares" DROP CONSTRAINT "FK_645d408c2a4052eefda29aa09b4"`,
    );
    await queryRunner.query(
      `ALTER TABLE "story_pages" DROP CONSTRAINT "FK_05b21c488dcc4b53a40a1414cda"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_audit_admin_created"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_audit_action"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_audit_target_type"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_audit_target_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_audit_created_at"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_audit_admin_id"`);
    await queryRunner.query(`DROP TABLE "audit_logs"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_notifications_user_created"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_notifications_user_read"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_notifications_created_at"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_notifications_is_read"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_notifications_user_id"`);
    await queryRunner.query(`DROP TABLE "notifications"`);
    await queryRunner.query(`DROP TYPE "public"."notifications_type_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_users_email"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_users_role"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_users_created_at"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_refresh_tokens_user_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_refresh_tokens_token"`);
    await queryRunner.query(`DROP TABLE "refresh_tokens"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_stories_user_visibility"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_stories_user_status"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_stories_language"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_stories_updated_at"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_stories_created_at"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_stories_story_type"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_stories_visibility"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_stories_status"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_stories_user_id"`);
    await queryRunner.query(`DROP TABLE "stories"`);
    await queryRunner.query(
      `DROP TYPE "public"."stories_coverimagestatus_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."stories_illustrationstatus_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."stories_language_enum"`);
    await queryRunner.query(
      `DROP TYPE "public"."stories_generationstatus_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."stories_theme_enum"`);
    await queryRunner.query(`DROP TYPE "public"."stories_civilization_enum"`);
    await queryRunner.query(`DROP TYPE "public"."stories_era_enum"`);
    await queryRunner.query(`DROP TYPE "public"."stories_storytype_enum"`);
    await queryRunner.query(`DROP TYPE "public"."stories_visibility_enum"`);
    await queryRunner.query(`DROP TYPE "public"."stories_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."stories_sourcetype_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_shares_user_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_shares_story_id"`);
    await queryRunner.query(`DROP TABLE "story_shares"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_pages_story_image_status"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_pages_story_page_number"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_pages_story_id"`);
    await queryRunner.query(`DROP TABLE "story_pages"`);
    await queryRunner.query(
      `DROP TYPE "public"."story_pages_imagestatus_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."story_pages_status_enum"`);
  }
}
