import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAffiliationUniqueness1763000000000 implements MigrationInterface {
  name = 'AddAffiliationUniqueness1763000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "user_sponsor_affiliations"
      WHERE id IN (
        SELECT id
        FROM (
          SELECT
            id,
            ROW_NUMBER() OVER (
              PARTITION BY user_id, sponsor_id
              ORDER BY affiliated_at DESC, created_at DESC, id DESC
            ) AS row_num
          FROM "user_sponsor_affiliations"
        ) ranked
        WHERE ranked.row_num > 1
      )
    `);

    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_user_sponsor_affiliations_user_sponsor_unique" ON "user_sponsor_affiliations" ("user_id", "sponsor_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_user_sponsor_affiliations_user_sponsor_unique"`,
    );
  }
}
