import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Поле «Иконка приложения» (квадрат) в SiteSettings — upload на media.
 * Колонка app_icon_id + FK на media (ON DELETE set null), по образцу logo_id.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "app_icon_id" integer;
  ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_app_icon_id_media_id_fk" FOREIGN KEY ("app_icon_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX IF NOT EXISTS "site_settings_app_icon_idx" ON "site_settings" USING btree ("app_icon_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "site_settings" DROP CONSTRAINT IF EXISTS "site_settings_app_icon_id_media_id_fk";
  DROP INDEX IF EXISTS "site_settings_app_icon_idx";
  ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "app_icon_id";`)
}
