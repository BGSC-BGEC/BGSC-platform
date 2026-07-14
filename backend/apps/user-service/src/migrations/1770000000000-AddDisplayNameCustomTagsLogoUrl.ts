import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDisplayNameCustomTagsLogoUrl1770000000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "display_name" VARCHAR(50) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "custom_tags" TEXT[] NOT NULL DEFAULT '{}'`,
    );
    await queryRunner.query(
      `ALTER TABLE "sponsors" ADD COLUMN IF NOT EXISTS "logo_url" TEXT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "display_name"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "custom_tags"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sponsors" DROP COLUMN IF EXISTS "logo_url"`,
    );
  }
}
