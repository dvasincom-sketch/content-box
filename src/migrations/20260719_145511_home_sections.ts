import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_site_settings_home_sections_type" AS ENUM('hero', 'heroTeam', 'latest', 'categories', 'whyUs', 'socials', 'broadcast');
  CREATE TABLE "site_settings_home_sections" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"type" "enum_site_settings_home_sections_type" NOT NULL,
  	"enabled" boolean DEFAULT true
  );
  
  ALTER TABLE "site_settings_home_sections" ADD CONSTRAINT "site_settings_home_sections_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."site_settings"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "site_settings_home_sections_order_idx" ON "site_settings_home_sections" USING btree ("_order");
  CREATE INDEX "site_settings_home_sections_parent_id_idx" ON "site_settings_home_sections" USING btree ("_parent_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "site_settings_home_sections" CASCADE;
  DROP TYPE "public"."enum_site_settings_home_sections_type";`)
}
