import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnforceCanonicalFriendships1780000001000 implements MigrationInterface {
  name = 'EnforceCanonicalFriendships1780000001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_friendships_unordered_pair"
      ON "friendships" (LEAST("requester_id", "recipient_id"), GREATEST("requester_id", "recipient_id"))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_friendships_unordered_pair"`,
    );
  }
}
