import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTotpAndAccountLifecycleAndAuditLog1718520000000 implements MigrationInterface {
  name = 'AddTotpAndAccountLifecycleAndAuditLog1718520000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Ensure uuid-ossp extension is enabled for UUID generation
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    // Create users table if it doesn't exist (base table from steps 1-10)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "username" character varying(50) NOT NULL,
        "email" character varying(255) NOT NULL,
        "password_hash" character varying(255),
        "role" character varying(50) NOT NULL DEFAULT 'user',
        "status" character varying(50) NOT NULL DEFAULT 'active',
        "google_id" character varying(255),
        "password_reset_token_hash" character varying(255),
        "password_reset_expires" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_users_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_users_username" UNIQUE ("username"),
        CONSTRAINT "UQ_users_email" UNIQUE ("email"),
        CONSTRAINT "UQ_users_google_id" UNIQUE ("google_id")
      )
    `);

    // Add TOTP columns to users table if they don't exist
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "totp_secret_enc" character varying(512)`);
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "totp_enabled" boolean NOT NULL DEFAULT false`);
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "totp_backup_codes_hash" text`);

    // Add Account Lifecycle columns to users table if they don't exist
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "disabled_at" TIMESTAMP WITH TIME ZONE`);
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "disabled_by" uuid`);
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "deletion_scheduled" TIMESTAMP WITH TIME ZONE`);

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
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "deletion_scheduled"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "disabled_by"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "disabled_at"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "totp_backup_codes_hash"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "totp_enabled"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "totp_secret_enc"`);
  }
}
