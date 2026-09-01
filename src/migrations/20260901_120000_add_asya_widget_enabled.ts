import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Тумблер сквозного виджета Аси: site_settings.asya_widget_enabled.
 * Новое поле Payload на site-settings — без колонки в БД любой запрос настроек
 * падает (Payload выбирает все колонки), поэтому колонку добавляем идемпотентно.
 * По умолчанию TRUE (виджет включён). На случай обрыва migrate — можно применить
 * этот ALTER вручную.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "asya_widget_enabled" boolean DEFAULT true;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "asya_widget_enabled";`)
}
