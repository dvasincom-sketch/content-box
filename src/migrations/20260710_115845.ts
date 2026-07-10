import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "site_settings_hero_team_members" ADD COLUMN "category_id" integer;
  ALTER TABLE "site_settings_hero_team_members" ADD CONSTRAINT "site_settings_hero_team_members_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "site_settings_hero_team_members_category_idx" ON "site_settings_hero_team_members" USING btree ("category_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "site_settings_hero_team_members" DROP CONSTRAINT "site_settings_hero_team_members_category_id_categories_id_fk";
  
  DROP INDEX "site_settings_hero_team_members_category_idx";
  ALTER TABLE "site_settings_hero_team_members" DROP COLUMN "category_id";`)
}
