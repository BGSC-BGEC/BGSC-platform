import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateChallenges1781000000000 implements MigrationInterface {
  name = 'CreateChallenges1781000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "challenges" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "title" character varying(200) NOT NULL,
        "description" text NOT NULL,
        "domain" character varying(50) NOT NULL,
        "team_limit" integer NOT NULL DEFAULT 1,
        "time_limit" integer NULL,
        "resource_links" text[] NOT NULL DEFAULT '{}',
        "award_points" integer NOT NULL,
        "difficulty" character varying(20) NOT NULL,
        "status" character varying(20) NOT NULL DEFAULT 'active',
        "created_by" uuid NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_challenges_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "challenge_acceptances" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "challenge_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "accepted_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_challenge_acceptances_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_challenge_acceptances_pair" UNIQUE ("challenge_id", "user_id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "challenge_submissions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "challenge_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "proof_url" text NULL,
        "proof_text" text NULL,
        "status" character varying(20) NOT NULL DEFAULT 'pending',
        "reviewer_id" uuid NULL,
        "review_notes" text NULL,
        "submitted_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "reviewed_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_challenge_submissions_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_challenges_status" ON "challenges" ("status")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_challenges_domain" ON "challenges" ("domain")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_challenges_difficulty" ON "challenges" ("difficulty")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_acceptances_user_id" ON "challenge_acceptances" ("user_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_acceptances_challenge_id" ON "challenge_acceptances" ("challenge_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_submissions_user_id" ON "challenge_submissions" ("user_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_submissions_challenge_id" ON "challenge_submissions" ("challenge_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_submissions_status" ON "challenge_submissions" ("status")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_submissions_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_submissions_challenge_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_submissions_user_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_acceptances_challenge_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_acceptances_user_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_challenges_difficulty"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_challenges_domain"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_challenges_status"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "challenge_submissions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "challenge_acceptances"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "challenges"`);
  }
}
