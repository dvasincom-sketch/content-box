import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "site_settings_hero_team_members" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"photo_id" integer NOT NULL,
  	"name" varchar
  );
  
  ALTER TABLE "site_settings" ADD COLUMN "hero_team_caption" varchar;
  ALTER TABLE "site_settings_hero_team_members" ADD CONSTRAINT "site_settings_hero_team_members_photo_id_media_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "site_settings_hero_team_members" ADD CONSTRAINT "site_settings_hero_team_members_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."site_settings"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "site_settings_hero_team_members_order_idx" ON "site_settings_hero_team_members" USING btree ("_order");
  CREATE INDEX "site_settings_hero_team_members_parent_id_idx" ON "site_settings_hero_team_members" USING btree ("_parent_id");
  CREATE INDEX "site_settings_hero_team_members_photo_idx" ON "site_settings_hero_team_members" USING btree ("photo_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "site_settings_hero_team_members" CASCADE;
  ALTER TABLE "site_settings" DROP COLUMN "hero_team_caption";`)
}
