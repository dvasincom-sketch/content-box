import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_site_settings_hero_team_avatar_size" AS ENUM('48', '64', '96', '128');
  ALTER TABLE "site_settings" ADD COLUMN "hero_team_avatar_size" "enum_site_settings_hero_team_avatar_size" DEFAULT '96';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "site_settings" DROP COLUMN "hero_team_avatar_size";
  DROP TYPE "public"."enum_site_settings_hero_team_avatar_size";`)
}
