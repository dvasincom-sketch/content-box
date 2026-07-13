import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "categories_seo_target_keywords" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"keyword" varchar NOT NULL
  );
  
  ALTER TABLE "categories_seo_target_keywords" ADD CONSTRAINT "categories_seo_target_keywords_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "categories_seo_target_keywords_order_idx" ON "categories_seo_target_keywords" USING btree ("_order");
  CREATE INDEX "categories_seo_target_keywords_parent_id_idx" ON "categories_seo_target_keywords" USING btree ("_parent_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "categories_seo_target_keywords" CASCADE;`)
}
