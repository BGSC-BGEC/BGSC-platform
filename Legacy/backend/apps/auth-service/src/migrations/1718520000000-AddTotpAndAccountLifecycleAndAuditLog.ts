import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTotpAndAccountLifecycleAndAuditLog1718520000000 implements MigrationInterface {
  name = 'AddTotpAndAccountLifecycleAndAuditLog1718520000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    // Create the users table if neither service has run yet.
    // All columns use ADD COLUMN IF NOT EXISTS below, so this is safe
    // regardless of which service's migration runs first.
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "username" character varying(50) NOT NULL,
        "email" character varying(320) NOT NULL,
        "role" character varying(50) NOT NULL DEFAULT 'user',
        "status" character varying(50) NOT NULL DEFAULT 'active',
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_users_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_users_username" UNIQUE ("username"),
        CONSTRAINT "UQ_users_email" UNIQUE ("email")
      )
    `);

    // Auth-owned columns — idempotent whether this migration runs first or second
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "password_hash" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "google_id" character varying(255)`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_users_google_id" ON "users" ("google_id") WHERE "google_id" IS NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "password_reset_token_hash" character varying(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "password_reset_expires" TIMESTAMP WITH TIME ZONE`,
    );

    // TOTP columns
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "totp_secret_enc" character varying(512)`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "totp_enabled" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "totp_backup_codes_hash" text`,
    );

    // Account lifecycle columns
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "disabled_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "disabled_by" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "deletion_scheduled" TIMESTAMP WITH TIME ZONE`,
    );

    // Create login_audit_log table if it doesn't exist
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "login_audit_log" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid,
        "ip_address" character varying(45) NOT NULL,
        "user_agent" text NOT NULL,
        "method" character varying(20) NOT NULL,
        "success" boolean NOT NULL,
        "failure_reason" character varying(100),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_login_audit_log_id" PRIMARY KEY ("id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "login_audit_log"`);
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "deletion_scheduled"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "disabled_by"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "disabled_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "totp_backup_codes_hash"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "totp_enabled"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "totp_secret_enc"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "password_reset_expires"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "password_reset_token_hash"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_users_google_id"`);
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "google_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "password_hash"`,
    );
  }
}
