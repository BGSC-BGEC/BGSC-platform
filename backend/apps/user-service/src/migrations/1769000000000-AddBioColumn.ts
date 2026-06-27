import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBioColumn1769000000000 implements MigrationInterface {
  name = 'AddBioColumn1769000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "bio" text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "bio"`,
    );
  }
}
