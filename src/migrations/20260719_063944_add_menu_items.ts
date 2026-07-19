import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_menu_items_location" AS ENUM('header', 'footer');
  CREATE TYPE "public"."enum_menu_items_kind" AS ENUM('category', 'page', 'url');
  CREATE TABLE "menu_items" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer,
  	"location" "enum_menu_items_location" DEFAULT 'header' NOT NULL,
  	"kind" "enum_menu_items_kind" DEFAULT 'category' NOT NULL,
  	"category_id" integer,
  	"page_id" integer,
  	"url" varchar,
  	"label_override" varchar,
  	"hidden" boolean DEFAULT false,
  	"parent_id" integer,
  	"order" numeric DEFAULT 0,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "menu_items_id" integer;
  ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_parent_id_menu_items_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."menu_items"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "menu_items_tenant_idx" ON "menu_items" USING btree ("tenant_id");
  CREATE INDEX "menu_items_category_idx" ON "menu_items" USING btree ("category_id");
  CREATE INDEX "menu_items_page_idx" ON "menu_items" USING btree ("page_id");
  CREATE INDEX "menu_items_parent_idx" ON "menu_items" USING btree ("parent_id");
  CREATE INDEX "menu_items_updated_at_idx" ON "menu_items" USING btree ("updated_at");
  CREATE INDEX "menu_items_created_at_idx" ON "menu_items" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_menu_items_fk" FOREIGN KEY ("menu_items_id") REFERENCES "public"."menu_items"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_menu_items_id_idx" ON "payload_locked_documents_rels" USING btree ("menu_items_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "menu_items" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "menu_items" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_menu_items_fk";
  
  DROP INDEX "payload_locked_documents_rels_menu_items_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "menu_items_id";
  DROP TYPE "public"."enum_menu_items_location";
  DROP TYPE "public"."enum_menu_items_kind";`)
}
