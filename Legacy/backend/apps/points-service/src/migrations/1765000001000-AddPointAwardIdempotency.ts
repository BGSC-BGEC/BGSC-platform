import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPointAwardIdempotency1765000001000 implements MigrationInterface {
  name = 'AddPointAwardIdempotency1765000001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "point_transactions" ADD COLUMN IF NOT EXISTS "idempotency_key" uuid`,
    );
    await queryRunner.query(`
      DO $$
      BEGIN
        IF to_regclass('public.registrations') IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'registrations'
              AND column_name = 'attended_at'
          )
        THEN
          WITH existing_awards AS (
            SELECT DISTINCT ON (r.id) p.id AS transaction_id, r.id AS registration_id
            FROM "registrations" r
            JOIN "point_transactions" p
              ON p."user_id" = r."user_id"
             AND p."reference_id" = r."event_id"
             AND p."source" = 'event'
             AND p."type" = 'earn'
             AND p."amount" = 10
            WHERE r."attended_at" IS NOT NULL
              AND p."idempotency_key" IS NULL
            ORDER BY r.id, p."created_at", p.id
          )
          UPDATE "point_transactions" p
          SET "idempotency_key" = existing_awards.registration_id
          FROM existing_awards
          WHERE p.id = existing_awards.transaction_id;
        END IF;
      END $$
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_point_transactions_idempotency_key" ON "point_transactions" ("idempotency_key")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_point_transactions_idempotency_key"`,
    );
    await queryRunner.query(
      `ALTER TABLE "point_transactions" DROP COLUMN IF EXISTS "idempotency_key"`,
    );
  }
}
