import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSocialEntities1780000000000 implements MigrationInterface {
  name = 'CreateSocialEntities1780000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "friendships" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "requester_id" uuid NOT NULL,
        "recipient_id" uuid NOT NULL,
        "status" character varying(20) NOT NULL DEFAULT 'pending',
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_friendships_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_friendships_pair" UNIQUE ("requester_id", "recipient_id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "posts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "caption" text NULL,
        "media_urls" text[] NOT NULL DEFAULT '{}',
        "tags" text[] NOT NULL DEFAULT '{}',
        "visibility" character varying(20) NOT NULL DEFAULT 'public',
        "likes_enabled" boolean NOT NULL DEFAULT true,
        "comments_enabled" boolean NOT NULL DEFAULT true,
        "comments_visibility" character varying(20) NOT NULL DEFAULT 'public',
        "shares_allowed" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_posts_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "post_likes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "post_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_post_likes_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_post_likes_post_user" UNIQUE ("post_id", "user_id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "post_comments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "post_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "body" text NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_post_comments_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_friendships_requester" ON "friendships" ("requester_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_friendships_recipient" ON "friendships" ("recipient_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_friendships_status" ON "friendships" ("status")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_posts_user_id" ON "posts" ("user_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_posts_visibility" ON "posts" ("visibility")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_posts_created_at" ON "posts" ("created_at" DESC)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_post_likes_post_id" ON "post_likes" ("post_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_post_comments_post_id" ON "post_comments" ("post_id")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_post_comments_post_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_post_likes_post_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_posts_created_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_posts_visibility"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_posts_user_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_friendships_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_friendships_recipient"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_friendships_requester"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "post_comments"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "post_likes"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "posts"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "friendships"`);
  }
}
