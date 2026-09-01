import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Переопределение шрифтов поверх пресета темы: site_settings.font_heading /
 * font_body. Новые поля Payload на site-settings — без колонок запрос настроек
 * падает целиком, поэтому добавляем идемпотентно (пусто = как в теме).
 * На случай обрыва migrate — можно применить эти ALTER вручную.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "font_heading" varchar;
    ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "font_body" varchar;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "font_heading";
    ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "font_body";`)
}
