import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Прогресс транскодинга видео (0..100) для живого индикатора «Обрабатывается
 * NN%». Воркер пишет out_time/duration от ffmpeg по ходу кодирования; студия
 * опрашивает и показывает реальное движение.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "video_jobs" ADD COLUMN IF NOT EXISTS "progress" smallint DEFAULT 0 NOT NULL;`)
}
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "video_jobs" DROP COLUMN IF EXISTS "progress";`)
}
