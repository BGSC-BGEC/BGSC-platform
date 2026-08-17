import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAttendancePointDelivery1764000002000 implements MigrationInterface {
  name = 'AddAttendancePointDelivery1764000002000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "registrations" ADD COLUMN IF NOT EXISTS "points_awarded_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_registrations_pending_points" ON "registrations" ("attended_at") WHERE "attended_at" IS NOT NULL AND "points_awarded_at" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_registrations_pending_points"`,
    );
    await queryRunner.query(
      `ALTER TABLE "registrations" DROP COLUMN IF EXISTS "points_awarded_at"`,
    );
  }
}
