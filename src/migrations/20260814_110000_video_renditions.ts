import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Выбор хранимых разрешений видео. site_settings.video_renditions — тенант-дефолт
 * (какие дорожки генерировать для новых загрузок; по умолчанию 480,720 — 1080
 * опционально из-за объёма). video_jobs.rendition_heights — штамп на задачу.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "video_renditions" varchar DEFAULT '480,720';
  ALTER TABLE "video_jobs" ADD COLUMN IF NOT EXISTS "rendition_heights" varchar;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "video_renditions";
  ALTER TABLE "video_jobs" DROP COLUMN IF EXISTS "rendition_heights";`)
}
