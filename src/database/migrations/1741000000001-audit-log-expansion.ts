import { MigrationInterface, QueryRunner } from 'typeorm';

export class AuditLogExpansion1741000000001 implements MigrationInterface {
  name = 'AuditLogExpansion1741000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "audit_logs" ADD "actorName" varchar(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE "audit_logs" ADD "actorRole" varchar(50)`,
    );
    await queryRunner.query(
      `ALTER TABLE "audit_logs" ADD "description" varchar(500)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_audit_actor_name" ON "audit_logs" ("actorName")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_audit_actor_name"`);
    await queryRunner.query(
      `ALTER TABLE "audit_logs" DROP COLUMN "description"`,
    );
    await queryRunner.query(`ALTER TABLE "audit_logs" DROP COLUMN "actorRole"`);
    await queryRunner.query(`ALTER TABLE "audit_logs" DROP COLUMN "actorName"`);
  }
}
