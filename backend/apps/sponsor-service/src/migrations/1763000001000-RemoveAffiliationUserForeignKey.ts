import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveAffiliationUserForeignKey1763000001000
  implements MigrationInterface
{
  name = 'RemoveAffiliationUserForeignKey1763000001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "user_sponsor_affiliations"
      DROP CONSTRAINT IF EXISTS "FK_user_sponsor_affiliations_user"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasUsersTable = await queryRunner.hasTable('users');

    if (hasUsersTable) {
      await queryRunner.query(`
        ALTER TABLE "user_sponsor_affiliations"
        ADD CONSTRAINT "FK_user_sponsor_affiliations_user"
        FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      `);
    }
  }
}
