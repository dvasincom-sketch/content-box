import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * custom-themes — библиотека пользовательских палитр тенанта (json {dark,light}).
 * Плюс на site-settings: theme_source (пресет|своя) и active_custom_theme (id
 * активной своей темы). Тенант-скоуп коллекция + проводка в
 * payload_locked_documents_rels — по образцу ai-usage.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_site_settings_theme_source" AS ENUM('preset', 'custom');
  CREATE TABLE "custom_themes" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer,
  	"name" varchar NOT NULL,
  	"theme" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  ALTER TABLE "site_settings" ADD COLUMN "theme_source" "enum_site_settings_theme_source" DEFAULT 'preset';
  ALTER TABLE "site_settings" ADD COLUMN "active_custom_theme" numeric;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "custom_themes_id" integer;
  ALTER TABLE "custom_themes" ADD CONSTRAINT "custom_themes_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "custom_themes_tenant_idx" ON "custom_themes" USING btree ("tenant_id");
  CREATE INDEX "custom_themes_created_at_idx" ON "custom_themes" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_custom_themes_fk" FOREIGN KEY ("custom_themes_id") REFERENCES "public"."custom_themes"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_custom_themes_id_idx" ON "payload_locked_documents_rels" USING btree ("custom_themes_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "custom_themes" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "custom_themes" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_custom_themes_fk";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_custom_themes_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "custom_themes_id";
  ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "active_custom_theme";
  ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "theme_source";
  DROP TYPE "public"."enum_site_settings_theme_source";`)
}
