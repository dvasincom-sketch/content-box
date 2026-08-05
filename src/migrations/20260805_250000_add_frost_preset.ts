import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Новый пресет оформления 'frost' («Ледяной иней») — icy blue + aurora,
 * для демо-тенанта Frozen. enum_site_settings_theme_preset += 'frost'.
 * Колонка theme_preset уже существует — добавляется только значение enum.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_site_settings_theme_preset" ADD VALUE IF NOT EXISTS 'frost';`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Значение enum в PostgreSQL убрать нельзя; тенанты на 'frost' переводим на дефолт,
  // иначе после отката останутся строки со значением, которого нет в коде.
  await db.execute(sql`
   UPDATE "site_settings" SET "theme_preset" = 'neon-dawn' WHERE "theme_preset" = 'frost';`)
}
