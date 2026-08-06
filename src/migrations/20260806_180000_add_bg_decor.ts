import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Поле site-settings.bgDecor — выбор фонового декора фан-сайта из библиотеки
 * (none + 12 объектов). Payload select → enum enum_site_settings_bg_decor + колонка.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_site_settings_bg_decor" AS ENUM('none', 'palms', 'mountains', 'city', 'forest', 'waves', 'stars', 'hearts', 'snowflakes', 'notes', 'confetti', 'sakura', 'bubbles');
   ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "bg_decor" "enum_site_settings_bg_decor" DEFAULT 'none';`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "bg_decor";
   DROP TYPE IF EXISTS "public"."enum_site_settings_bg_decor";`)
}
