import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSponsorsAndAffiliations1762000000000
  implements MigrationInterface
{
  name = 'CreateSponsorsAndAffiliations1762000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

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

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sponsors" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying(120) NOT NULL,
        "logo_url" text,
        "description" text,
        "website_url" text,
        "tenure_start" date NOT NULL,
        "tenure_end" date,
        "status" character varying(50) NOT NULL DEFAULT 'active',
        "total_fans" integer NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_sponsors_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_sponsors_name" UNIQUE ("name")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_sponsor_affiliations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "sponsor_id" uuid NOT NULL,
        "affiliated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "fan_count" integer NOT NULL DEFAULT 0,
        "events_won" text[] NOT NULL DEFAULT '{}',
        "total_points_contributed" integer NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_sponsor_affiliations_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_user_sponsor_affiliations_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_user_sponsor_affiliations_sponsor" FOREIGN KEY ("sponsor_id") REFERENCES "sponsors"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_user_sponsor_affiliations_user_id" ON "user_sponsor_affiliations" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_user_sponsor_affiliations_sponsor_id" ON "user_sponsor_affiliations" ("sponsor_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_user_sponsor_affiliations_sponsor_id"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_user_sponsor_affiliations_user_id"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "user_sponsor_affiliations"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "sponsors"`);
  }
}
