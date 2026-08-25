import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Ручной порядок смешанного содержимого категории (подкатегории + публикации).
 * JSON-массив ссылок [{k,id}] на самой категории. DDL идемпотентный
 * (IF NOT EXISTS) — managed-БД Timeweb иногда рвёт соединение посреди миграции.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "content_order" jsonb;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "categories" DROP COLUMN IF EXISTS "content_order";`)
}
