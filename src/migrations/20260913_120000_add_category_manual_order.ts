import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Категория: флаг «ручной порядок содержимого» — categories.manual_order.
 * Новое поле Payload на categories: без колонки любой запрос категорий падает
 * (Payload выбирает все колонки), поэтому колонку добавляем идемпотентно.
 * По умолчанию FALSE — раздел сортируется по дате (новые сверху), сохранённый
 * ручной contentOrder игнорируется, пока флаг не включён.
 * На случай обрыва migrate ALTER можно применить вручную.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "manual_order" boolean DEFAULT false;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "categories" DROP COLUMN IF EXISTS "manual_order";`)
}
