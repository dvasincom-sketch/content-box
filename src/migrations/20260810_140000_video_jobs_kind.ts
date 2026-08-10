import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/** Тип задачи очереди: 'transcode' (полный пайплайн) | 'subtitles' (только whisper
 * для уже готового видео — аудио берём из HLS, оригинала уже нет). */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "video_jobs" ADD COLUMN IF NOT EXISTS "kind" varchar DEFAULT 'transcode' NOT NULL;`)
}
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "video_jobs" DROP COLUMN IF EXISTS "kind";`)
}
