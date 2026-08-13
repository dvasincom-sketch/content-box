import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Один предыдущий снимок публикации (страховка от случайного сохранения).
 * prev_version (jsonb) — контент публикации, каким он был ДО последнего
 * сохранения; кнопка «Восстановить» в редакторе меняет местами текущее и снимок.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "publications" ADD COLUMN IF NOT EXISTS "prev_version" jsonb;`)
}
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "publications" DROP COLUMN IF EXISTS "prev_version";`)
}
