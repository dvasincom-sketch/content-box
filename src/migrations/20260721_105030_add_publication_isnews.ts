import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_site_settings_home_sections_type" ADD VALUE 'news' BEFORE 'latest';
  ALTER TYPE "public"."enum_site_settings_home_sections_type" ADD VALUE 'popular' BEFORE 'categories';
  ALTER TYPE "public"."enum_site_settings_home_sections_type" ADD VALUE 'discussed' BEFORE 'categories';
  ALTER TYPE "public"."enum_site_settings_home_sections_type" ADD VALUE 'popularCategories' BEFORE 'whyUs';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "site_settings_home_sections" ALTER COLUMN "type" SET DATA TYPE text;
  DROP TYPE "public"."enum_site_settings_home_sections_type";
  CREATE TYPE "public"."enum_site_settings_home_sections_type" AS ENUM('hero', 'heroTeam', 'latest', 'categories', 'whyUs', 'socials', 'broadcast');
  ALTER TABLE "site_settings_home_sections" ALTER COLUMN "type" SET DATA TYPE "public"."enum_site_settings_home_sections_type" USING "type"::"public"."enum_site_settings_home_sections_type";`)
}
