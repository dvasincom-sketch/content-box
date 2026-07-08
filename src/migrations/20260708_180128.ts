import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "site_settings_tenant_idx";
  ALTER TABLE "pages" ALTER COLUMN "slug" DROP DEFAULT;
  ALTER TABLE "pages" ADD COLUMN "title" varchar NOT NULL;
  ALTER TABLE "pages" ADD COLUMN "content" jsonb;
  ALTER TABLE "pages" ADD COLUMN "show_in_menu" boolean DEFAULT false;
  ALTER TABLE "pages" ADD COLUMN "show_in_footer" boolean DEFAULT false;
  ALTER TABLE "pages" ADD COLUMN "menu_order" numeric DEFAULT 0;
  ALTER TABLE "pages" ADD COLUMN "seo_title" varchar;
  ALTER TABLE "pages" ADD COLUMN "seo_description" varchar;
  CREATE INDEX "site_settings_tenant_idx" ON "site_settings" USING btree ("tenant_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "site_settings_tenant_idx";
  ALTER TABLE "pages" ALTER COLUMN "slug" SET DEFAULT 'home';
  CREATE UNIQUE INDEX "site_settings_tenant_idx" ON "site_settings" USING btree ("tenant_id");
  ALTER TABLE "pages" DROP COLUMN "title";
  ALTER TABLE "pages" DROP COLUMN "content";
  ALTER TABLE "pages" DROP COLUMN "show_in_menu";
  ALTER TABLE "pages" DROP COLUMN "show_in_footer";
  ALTER TABLE "pages" DROP COLUMN "menu_order";
  ALTER TABLE "pages" DROP COLUMN "seo_title";
  ALTER TABLE "pages" DROP COLUMN "seo_description";`)
}
