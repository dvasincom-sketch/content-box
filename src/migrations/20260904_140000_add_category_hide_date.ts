import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Категория: флаг «не показывать дату у публикаций раздела» —
 * categories.hide_date. Новое поле Payload на categories: без колонки любой
 * запрос категорий падает (Payload выбирает все колонки), поэтому добавляем
 * колонку идемпотентно. По умолчанию FALSE (даты показываются, как раньше).
 * На случай обрыва migrate ALTER можно применить вручную.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "hide_date" boolean DEFAULT false;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "categories" DROP COLUMN IF EXISTS "hide_date";`)
}
