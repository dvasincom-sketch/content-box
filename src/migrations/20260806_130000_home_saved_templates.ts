import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * «Мои шаблоны» главной + отметка применённого шаблона:
 *  - `saved_templates` (jsonb) — массив пользовательских шаблонов тенанта
 *    ({ id, name, themePreset, sections, content });
 *  - `applied_template` (varchar) — id последнего применённого шаблона.
 * Оба — на главной таблице site_settings (одна запись на тенант).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "saved_templates" jsonb;`)
  await db.execute(sql`ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "applied_template" varchar;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "saved_templates";`)
  await db.execute(sql`ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "applied_template";`)
}
