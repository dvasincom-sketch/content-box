import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Депозит тенанта на оплату ИИ: site_settings.ai_deposit_rub (₽). Пополняется
 * авансом, из него ежемесячно списывается стоимость токенов. Для пилота — 200000.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "ai_deposit_rub" numeric DEFAULT 0;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "ai_deposit_rub";`)
}
