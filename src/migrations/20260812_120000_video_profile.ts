import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Профиль сжатия видео. site_settings.video_profile — дефолт проекта для новых
 * загрузок; video_jobs.profile — профиль конкретной задачи (штампуется при
 * постановке в очередь, поэтому смена дефолта не трогает уже загруженные).
 * Значения: fast | balanced | compact | quality.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "video_profile" varchar DEFAULT 'balanced';
    ALTER TABLE "video_jobs" ADD COLUMN IF NOT EXISTS "profile" varchar DEFAULT 'balanced' NOT NULL;`)
}
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "video_jobs" DROP COLUMN IF EXISTS "profile";
    ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "video_profile";`)
}
