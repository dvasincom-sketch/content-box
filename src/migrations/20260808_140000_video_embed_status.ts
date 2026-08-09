import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Статус доступности внешнего (embed) видео — результат валидатора
 * (/api/videos/validate). ok/unavailable/unknown + отметка времени проверки.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "videos" ADD COLUMN IF NOT EXISTS "embed_status" varchar;
  ALTER TABLE "videos" ADD COLUMN IF NOT EXISTS "embed_checked_at" timestamp(3) with time zone;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "videos" DROP COLUMN IF EXISTS "embed_checked_at";
  ALTER TABLE "videos" DROP COLUMN IF EXISTS "embed_status";`)
}
