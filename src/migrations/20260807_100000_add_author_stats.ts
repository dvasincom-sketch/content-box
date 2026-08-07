import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Управляемые счётчики витрины «Об авторе» (site-settings.authorStats — group).
 * Payload group → колонки author_stats_*. Значения строковые (можно «800+»).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "author_stats_videos_value" varchar;
   ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "author_stats_videos_label" varchar DEFAULT 'озвученных видео';
   ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "author_stats_members_value" varchar;
   ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "author_stats_members_label" varchar DEFAULT 'участников';`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "author_stats_videos_value";
   ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "author_stats_videos_label";
   ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "author_stats_members_value";
   ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "author_stats_members_label";`)
}
