import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePointTransactions1765000000000 implements MigrationInterface {
  name = 'CreatePointTransactions1765000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "point_transactions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "amount" integer NOT NULL,
        "type" character varying(20) NOT NULL,
        "source" character varying(30) NOT NULL,
        "reference_id" uuid,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_point_transactions_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_point_transactions_user_id" ON "point_transactions" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_point_transactions_reference_id" ON "point_transactions" ("reference_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_point_transactions_reference_id"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_point_transactions_user_id"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "point_transactions"`);
  }
}
