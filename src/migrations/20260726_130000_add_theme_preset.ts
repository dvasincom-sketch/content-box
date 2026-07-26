import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * site-settings.themePreset — enum готового пресета оформления.
 * Значения и порядок совпадают с THEME_PRESETS (lib/themePresets.ts).
 * DEFAULT 'neon-dawn' также проставляет дефолт существующим тенантам
 * (ADD COLUMN с DEFAULT заполняет уже существующие строки).
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_site_settings_theme_preset" AS ENUM('neon-dawn', 'warm-earth', 'digital-monolith', 'velvet-resonance', 'amber-pulse');
  ALTER TABLE "site_settings" ADD COLUMN "theme_preset" "enum_site_settings_theme_preset" DEFAULT 'neon-dawn';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "site_settings" DROP COLUMN "theme_preset";
  DROP TYPE "public"."enum_site_settings_theme_preset";`)
}
