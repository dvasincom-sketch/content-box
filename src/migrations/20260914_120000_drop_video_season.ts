import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Убираем поле «Сезон» у видео. Сезоны как отдельная сущность больше не нужны —
 * разные сезоны заводятся отдельными категориями (подразделами), а не полем у
 * каждого видео. Оставляем `episode` (порядок серий в плейлисте).
 *
 * Идемпотентно (IF EXISTS). down восстанавливает колонку пустой.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "videos" DROP COLUMN IF EXISTS "season";`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "videos" ADD COLUMN IF NOT EXISTS "season" numeric;`)
}
