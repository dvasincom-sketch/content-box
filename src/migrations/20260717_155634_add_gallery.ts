import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "publications_gallery" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"image_id" integer NOT NULL,
  	"caption" varchar
  );
  
  CREATE TABLE "gallery_images" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer,
  	"alt" varchar,
  	"folder_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric
  );
  
  CREATE TABLE "gallery_folders_breadcrumbs" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"doc_id" integer,
  	"url" varchar,
  	"label" varchar
  );
  
  CREATE TABLE "gallery_folders" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer,
  	"title" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"parent_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "gallery_images_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "gallery_folders_id" integer;
  ALTER TABLE "publications_gallery" ADD CONSTRAINT "publications_gallery_image_id_gallery_images_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."gallery_images"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "publications_gallery" ADD CONSTRAINT "publications_gallery_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."publications"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "gallery_images" ADD CONSTRAINT "gallery_images_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "gallery_images" ADD CONSTRAINT "gallery_images_folder_id_gallery_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."gallery_folders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "gallery_folders_breadcrumbs" ADD CONSTRAINT "gallery_folders_breadcrumbs_doc_id_gallery_folders_id_fk" FOREIGN KEY ("doc_id") REFERENCES "public"."gallery_folders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "gallery_folders_breadcrumbs" ADD CONSTRAINT "gallery_folders_breadcrumbs_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."gallery_folders"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "gallery_folders" ADD CONSTRAINT "gallery_folders_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "gallery_folders" ADD CONSTRAINT "gallery_folders_parent_id_gallery_folders_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."gallery_folders"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "publications_gallery_order_idx" ON "publications_gallery" USING btree ("_order");
  CREATE INDEX "publications_gallery_parent_id_idx" ON "publications_gallery" USING btree ("_parent_id");
  CREATE INDEX "publications_gallery_image_idx" ON "publications_gallery" USING btree ("image_id");
  CREATE INDEX "gallery_images_tenant_idx" ON "gallery_images" USING btree ("tenant_id");
  CREATE INDEX "gallery_images_folder_idx" ON "gallery_images" USING btree ("folder_id");
  CREATE INDEX "gallery_images_updated_at_idx" ON "gallery_images" USING btree ("updated_at");
  CREATE INDEX "gallery_images_created_at_idx" ON "gallery_images" USING btree ("created_at");
  CREATE UNIQUE INDEX "gallery_images_filename_idx" ON "gallery_images" USING btree ("filename");
  CREATE INDEX "gallery_folders_breadcrumbs_order_idx" ON "gallery_folders_breadcrumbs" USING btree ("_order");
  CREATE INDEX "gallery_folders_breadcrumbs_parent_id_idx" ON "gallery_folders_breadcrumbs" USING btree ("_parent_id");
  CREATE INDEX "gallery_folders_breadcrumbs_doc_idx" ON "gallery_folders_breadcrumbs" USING btree ("doc_id");
  CREATE INDEX "gallery_folders_tenant_idx" ON "gallery_folders" USING btree ("tenant_id");
  CREATE INDEX "gallery_folders_slug_idx" ON "gallery_folders" USING btree ("slug");
  CREATE INDEX "gallery_folders_parent_idx" ON "gallery_folders" USING btree ("parent_id");
  CREATE INDEX "gallery_folders_updated_at_idx" ON "gallery_folders" USING btree ("updated_at");
  CREATE INDEX "gallery_folders_created_at_idx" ON "gallery_folders" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_gallery_images_fk" FOREIGN KEY ("gallery_images_id") REFERENCES "public"."gallery_images"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_gallery_folders_fk" FOREIGN KEY ("gallery_folders_id") REFERENCES "public"."gallery_folders"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_gallery_images_id_idx" ON "payload_locked_documents_rels" USING btree ("gallery_images_id");
  CREATE INDEX "payload_locked_documents_rels_gallery_folders_id_idx" ON "payload_locked_documents_rels" USING btree ("gallery_folders_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "publications_gallery" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "gallery_images" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "gallery_folders_breadcrumbs" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "gallery_folders" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "publications_gallery" CASCADE;
  DROP TABLE "gallery_images" CASCADE;
  DROP TABLE "gallery_folders_breadcrumbs" CASCADE;
  DROP TABLE "gallery_folders" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_gallery_images_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_gallery_folders_fk";
  
  DROP INDEX "payload_locked_documents_rels_gallery_images_id_idx";
  DROP INDEX "payload_locked_documents_rels_gallery_folders_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "gallery_images_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "gallery_folders_id";`)
}
