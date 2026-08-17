import { MigrationInterface, QueryRunner } from 'typeorm';

export class HardenEventIntegrity1764000001000 implements MigrationInterface {
  name = 'HardenEventIntegrity1764000001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "registrations" ADD COLUMN IF NOT EXISTS "attended_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_registrations_event_user_integrity" ON "registrations" ("event_id", "user_id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_event_scores_event_user_integrity" ON "event_scores" ("event_id", "user_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_event_scores_event_user_integrity"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_registrations_event_user_integrity"`,
    );
    await queryRunner.query(
      `ALTER TABLE "registrations" DROP COLUMN IF EXISTS "attended_at"`,
    );
  }
}
