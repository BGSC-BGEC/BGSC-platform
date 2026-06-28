import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateNotifications1771000000000 implements MigrationInterface {
  name = 'CreateNotifications1771000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "notifications" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "type" character varying(50) NOT NULL,
        "title" character varying(200) NOT NULL,
        "body" text NOT NULL,
        "is_read" boolean NOT NULL DEFAULT false,
        "reference_id" uuid NULL,
        "reference_type" character varying(50) NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_notifications_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_notifications_user_id" ON "notifications" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_notifications_user_unread" ON "notifications" ("user_id") WHERE "is_read" = false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_notifications_user_unread"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_notifications_user_id"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "notifications"`);
  }
}
