import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Подпись у соцсетей (site_settings_socials.description) + карточки «Почему мы»
 * (site_settings.why_us, json) — оба редактируются в конструкторе главной.
 * DDL идемпотентный (IF NOT EXISTS) — managed-БД Timeweb иногда рвёт соединение.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "site_settings_socials" ADD COLUMN IF NOT EXISTS "description" varchar;
   ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "why_us" jsonb;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "site_settings_socials" DROP COLUMN IF EXISTS "description";
   ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "why_us";`)
}
