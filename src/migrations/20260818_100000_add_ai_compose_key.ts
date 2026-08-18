import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Ключ Аси (capability compose) на уровне тенанта: site_settings.ai_compose_key.
 * Позволяет вводить ключ прямо в студии вместо платформенного env
 * (ASYA_COMPOSE_KEY остаётся фолбэком). Секрет — читается только staff своего
 * тенанта, на публичный сайт не отдаётся.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "ai_compose_key" varchar;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "ai_compose_key";`)
}
