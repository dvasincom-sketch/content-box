import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "site_settings" ADD COLUMN "banner_tagline" varchar;
  ALTER TABLE "site_settings" ADD COLUMN "banner_on_air_text" varchar;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "site_settings" DROP COLUMN "banner_tagline";
  ALTER TABLE "site_settings" DROP COLUMN "banner_on_air_text";`)
}
