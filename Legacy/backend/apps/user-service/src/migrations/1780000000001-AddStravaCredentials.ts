import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStravaCredentials1780000000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "strava_credentials" (
        "id"                UUID          NOT NULL DEFAULT gen_random_uuid(),
        "user_id"           UUID          NOT NULL,
        "athlete_id"        VARCHAR(30)   NOT NULL,
        "access_token_enc"  TEXT          NOT NULL,
        "refresh_token_enc" TEXT          NOT NULL,
        "expires_at"        BIGINT        NOT NULL,
        "scope"             VARCHAR(255)  NOT NULL,
        "created_at"        TIMESTAMPTZ   NOT NULL DEFAULT now(),
        "updated_at"        TIMESTAMPTZ   NOT NULL DEFAULT now(),
        CONSTRAINT "PK_strava_credentials" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_strava_credentials_user_id" UNIQUE ("user_id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_strava_credentials_athlete_id" ON "strava_credentials" ("athlete_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "strava_credentials"`);
  }
}
