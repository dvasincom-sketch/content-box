import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Новый пресет оформления 'tropic-sunset' («Тропический закат») — фиолетовый фон
 * + оранжевые акценты/шапка + пальмы по бокам. Заменяет в UI 'velvet-resonance'
 * (тот убран из THEME_PRESETS). enum_site_settings_theme_preset += 'tropic-sunset'.
 * Значение 'velvet-resonance' из enum убрать нельзя (PG), оставляем как неиспользуемое;
 * getPreset() откатывает такие тенанты на дефолт.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_site_settings_theme_preset" ADD VALUE IF NOT EXISTS 'tropic-sunset';`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Значение enum в PostgreSQL убрать нельзя; тенанты на 'tropic-sunset' переводим на дефолт.
  await db.execute(sql`
   UPDATE "site_settings" SET "theme_preset" = 'neon-dawn' WHERE "theme_preset" = 'tropic-sunset';`)
}
