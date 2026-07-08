import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_site_settings_typography_heading_font" AS ENUM('inter', 'montserrat', 'manrope', 'golos', 'ptsans', 'unbounded', 'roboto');
  CREATE TYPE "public"."enum_site_settings_typography_body_font" AS ENUM('inter', 'montserrat', 'manrope', 'golos', 'ptsans', 'roboto');
  CREATE TYPE "public"."enum_site_settings_typography_text_size" AS ENUM('18', '20', '22', '24');
  CREATE TYPE "public"."enum_site_settings_typography_text_weight" AS ENUM('300', '400');
  CREATE TYPE "public"."enum_site_settings_typography_heading_weight" AS ENUM('300', '400', '500', '600', '700');
  ALTER TABLE "site_settings" ADD COLUMN "typography_heading_font" "enum_site_settings_typography_heading_font" DEFAULT 'inter';
  ALTER TABLE "site_settings" ADD COLUMN "typography_body_font" "enum_site_settings_typography_body_font" DEFAULT 'inter';
  ALTER TABLE "site_settings" ADD COLUMN "typography_text_size" "enum_site_settings_typography_text_size" DEFAULT '18';
  ALTER TABLE "site_settings" ADD COLUMN "typography_text_weight" "enum_site_settings_typography_text_weight" DEFAULT '400';
  ALTER TABLE "site_settings" ADD COLUMN "typography_heading_weight" "enum_site_settings_typography_heading_weight" DEFAULT '700';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "site_settings" DROP COLUMN "typography_heading_font";
  ALTER TABLE "site_settings" DROP COLUMN "typography_body_font";
  ALTER TABLE "site_settings" DROP COLUMN "typography_text_size";
  ALTER TABLE "site_settings" DROP COLUMN "typography_text_weight";
  ALTER TABLE "site_settings" DROP COLUMN "typography_heading_weight";
  DROP TYPE "public"."enum_site_settings_typography_heading_font";
  DROP TYPE "public"."enum_site_settings_typography_body_font";
  DROP TYPE "public"."enum_site_settings_typography_text_size";
  DROP TYPE "public"."enum_site_settings_typography_text_weight";
  DROP TYPE "public"."enum_site_settings_typography_heading_weight";`)
}
