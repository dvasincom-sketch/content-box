import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Тепловая карта/удержание просмотров своего видео. Сырая таблица (как
 * video_jobs) — высокочастотные апдейты идут через пул, не через Payload.
 * bucket — процентный слот 0..99 (нормируем по длительности, не зависит от длины
 * видео); plays — сколько раз этот слот проигран.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "video_heatmap" (
      "video_id" integer NOT NULL,
      "bucket" smallint NOT NULL,
      "plays" integer NOT NULL DEFAULT 0,
      PRIMARY KEY ("video_id", "bucket")
    );
  `)
}
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`DROP TABLE IF EXISTS "video_heatmap";`)
}
