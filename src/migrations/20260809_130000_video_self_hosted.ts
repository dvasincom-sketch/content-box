import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Своё видеохранилище (provider='self') — Фаза 1 (VOD MVP).
 *
 * 1) Расширяем enum провайдера значением 'self'.
 * 2) Добавляем поля HLS-конвейера в videos (пишет только сервер/воркер).
 * 3) Создаём таблицу очереди транскода video_jobs — воркер забирает задачи
 *    через FOR UPDATE SKIP LOCKED.
 *
 * ADD VALUE к enum не используется в этой же миграции (только объявляем),
 * поэтому безопасно внутри транзакции.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`ALTER TYPE "public"."enum_videos_provider" ADD VALUE IF NOT EXISTS 'self';`)

  await db.execute(sql`
    CREATE TYPE "public"."enum_videos_asset_status" AS ENUM('uploading', 'processing', 'ready', 'error');
    ALTER TABLE "videos" ADD COLUMN IF NOT EXISTS "asset_status" "enum_videos_asset_status" DEFAULT 'processing';
    ALTER TABLE "videos" ADD COLUMN IF NOT EXISTS "playback_id" varchar;
    ALTER TABLE "videos" ADD COLUMN IF NOT EXISTS "original_key" varchar;
    ALTER TABLE "videos" ADD COLUMN IF NOT EXISTS "poster_key" varchar;
    ALTER TABLE "videos" ADD COLUMN IF NOT EXISTS "sprite_key" varchar;
    ALTER TABLE "videos" ADD COLUMN IF NOT EXISTS "gif_key" varchar;
    ALTER TABLE "videos" ADD COLUMN IF NOT EXISTS "renditions" jsonb;
    ALTER TABLE "videos" ADD COLUMN IF NOT EXISTS "asset_error" varchar;
    CREATE INDEX IF NOT EXISTS "videos_playback_id_idx" ON "videos" USING btree ("playback_id");`)

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "video_jobs" (
      "id" serial PRIMARY KEY NOT NULL,
      "video_id" integer NOT NULL,
      "tenant_id" integer,
      "playback_id" varchar NOT NULL,
      "original_key" varchar NOT NULL,
      "status" varchar DEFAULT 'queued' NOT NULL,
      "attempts" integer DEFAULT 0 NOT NULL,
      "error" text,
      "locked_at" timestamp(3) with time zone,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
    CREATE INDEX IF NOT EXISTS "video_jobs_status_idx" ON "video_jobs" USING btree ("status");
    CREATE INDEX IF NOT EXISTS "video_jobs_video_id_idx" ON "video_jobs" USING btree ("video_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "video_jobs";
    DROP INDEX IF EXISTS "videos_playback_id_idx";
    ALTER TABLE "videos" DROP COLUMN IF EXISTS "asset_status";
    ALTER TABLE "videos" DROP COLUMN IF EXISTS "playback_id";
    ALTER TABLE "videos" DROP COLUMN IF EXISTS "original_key";
    ALTER TABLE "videos" DROP COLUMN IF EXISTS "poster_key";
    ALTER TABLE "videos" DROP COLUMN IF EXISTS "sprite_key";
    ALTER TABLE "videos" DROP COLUMN IF EXISTS "gif_key";
    ALTER TABLE "videos" DROP COLUMN IF EXISTS "renditions";
    ALTER TABLE "videos" DROP COLUMN IF EXISTS "asset_error";
    DROP TYPE IF EXISTS "public"."enum_videos_asset_status";`)
  // enum_videos_provider 'self' не удаляем: PostgreSQL не умеет DROP VALUE.
}
