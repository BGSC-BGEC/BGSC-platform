import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateEvents1764000000000 implements MigrationInterface {
  name = 'CreateEvents1764000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "events" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "title" character varying(200) NOT NULL,
        "description" text,
        "type" character varying(10) NOT NULL,
        "status" character varying(20) NOT NULL DEFAULT 'upcoming',
        "start_date" TIMESTAMP WITH TIME ZONE NOT NULL,
        "end_date" TIMESTAMP WITH TIME ZONE NOT NULL,
        "registration_deadline" TIMESTAMP WITH TIME ZONE NOT NULL,
        "venue" character varying(200),
        "rules_pdf_url" text,
        "max_participants" integer,
        "needs_leaderboard" boolean NOT NULL DEFAULT false,
        "tags" text[] NOT NULL DEFAULT '{}',
        "created_by" uuid NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_events_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "registrations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "event_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "status" character varying(20) NOT NULL DEFAULT 'confirmed',
        "registered_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_registrations_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_registrations_event" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_registrations_event_user" UNIQUE ("event_id", "user_id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "event_scores" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "event_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "score" integer NOT NULL,
        "submitted_by" uuid NOT NULL,
        "submitted_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_event_scores_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_event_scores_event" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_event_scores_event_user" UNIQUE ("event_id", "user_id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_registrations_event_id" ON "registrations" ("event_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_registrations_user_id" ON "registrations" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_event_scores_event_id" ON "event_scores" ("event_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_event_scores_event_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_registrations_user_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_registrations_event_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "event_scores"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "registrations"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "events"`);
  }
}
