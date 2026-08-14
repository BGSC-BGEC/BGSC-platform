import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStravaActivities1780000000002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "strava_activities" (
        "strava_id"              VARCHAR(30)   NOT NULL,
        "user_id"                UUID          NOT NULL,
        "type"                   VARCHAR(100)  NOT NULL,
        "name"                   VARCHAR(255)  NOT NULL,
        "distance_meters"        FLOAT         NOT NULL,
        "moving_time_seconds"    INTEGER       NOT NULL,
        "elapsed_time_seconds"   INTEGER       NOT NULL,
        "total_elevation_gain"   FLOAT,
        "average_speed"          FLOAT,
        "average_heartrate"      FLOAT,
        "calories"               FLOAT,
        "start_date"             TIMESTAMPTZ   NOT NULL,
        "raw"                    JSONB         NOT NULL DEFAULT '{}',
        "synced_at"              TIMESTAMPTZ   NOT NULL DEFAULT now(),
        CONSTRAINT "PK_strava_activities" PRIMARY KEY ("strava_id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_strava_activities_user_id" ON "strava_activities" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_strava_activities_user_start" ON "strava_activities" ("user_id", "start_date" DESC)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "strava_activities"`);
  }
}
