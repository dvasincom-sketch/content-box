import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Внешний API: publications.external_ref (дедуп импорта) + ключ внешнего API на
 * site-settings (хеш sha256 + префикс для показа + даты). Значение ключа не
 * хранится — только хеш.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  // Идемпотентно (IF NOT EXISTS): managed-БД Timeweb иногда рвёт соединение
  // посреди миграции — повторный прогон не должен падать на «уже существует».
  await db.execute(sql`
   ALTER TABLE "publications" ADD COLUMN IF NOT EXISTS "external_ref" varchar;
  CREATE INDEX IF NOT EXISTS "publications_external_ref_idx" ON "publications" USING btree ("external_ref");
  ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "external_api_key_hash" varchar;
  CREATE INDEX IF NOT EXISTS "site_settings_external_api_key_hash_idx" ON "site_settings" USING btree ("external_api_key_hash");
  ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "external_api_key_prefix" varchar;
  ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "external_api_key_created_at" timestamp(3) with time zone;
  ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "external_api_key_last_used_at" timestamp(3) with time zone;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX IF EXISTS "publications_external_ref_idx";
  ALTER TABLE "publications" DROP COLUMN IF EXISTS "external_ref";
  DROP INDEX IF EXISTS "site_settings_external_api_key_hash_idx";
  ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "external_api_key_hash";
  ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "external_api_key_prefix";
  ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "external_api_key_created_at";
  ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "external_api_key_last_used_at";`)
}
