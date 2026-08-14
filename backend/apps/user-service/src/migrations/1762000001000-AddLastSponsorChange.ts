import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLastSponsorChange1762000001000 implements MigrationInterface {
  name = 'AddLastSponsorChange1762000001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_sponsor_change" TIMESTAMP WITH TIME ZONE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "last_sponsor_change"`,
    );
  }
}
