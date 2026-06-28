import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAnnouncements1772000000000 implements MigrationInterface {
  name = 'CreateAnnouncements1772000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "announcements" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "title" varchar(200) NOT NULL,
        "body" text NOT NULL,
        "type" varchar(50) NOT NULL,
        "tags" text[] NOT NULL DEFAULT '{}',
        "created_by" uuid NOT NULL,
        "whatsapp_sent" boolean NOT NULL DEFAULT false,
        "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_announcements_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_announcements_type" ON "announcements" ("type")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_announcements_expires_at" ON "announcements" ("expires_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_announcements_expires_at"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_announcements_type"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "announcements"`);
  }
}
