import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/** Дорожки субтитров своего видео: json [{ lang, label, key }]. */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "videos" ADD COLUMN IF NOT EXISTS "subtitles" jsonb;`)
}
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "videos" DROP COLUMN IF EXISTS "subtitles";`)
}
