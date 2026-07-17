import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "video_folders_breadcrumbs" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"doc_id" integer,
  	"url" varchar,
  	"label" varchar
  );
  
  CREATE TABLE "video_folders" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer,
  	"title" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"parent_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "videos" ADD COLUMN "folder_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "video_folders_id" integer;
  ALTER TABLE "video_folders_breadcrumbs" ADD CONSTRAINT "video_folders_breadcrumbs_doc_id_video_folders_id_fk" FOREIGN KEY ("doc_id") REFERENCES "public"."video_folders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "video_folders_breadcrumbs" ADD CONSTRAINT "video_folders_breadcrumbs_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."video_folders"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "video_folders" ADD CONSTRAINT "video_folders_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "video_folders" ADD CONSTRAINT "video_folders_parent_id_video_folders_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."video_folders"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "video_folders_breadcrumbs_order_idx" ON "video_folders_breadcrumbs" USING btree ("_order");
  CREATE INDEX "video_folders_breadcrumbs_parent_id_idx" ON "video_folders_breadcrumbs" USING btree ("_parent_id");
  CREATE INDEX "video_folders_breadcrumbs_doc_idx" ON "video_folders_breadcrumbs" USING btree ("doc_id");
  CREATE INDEX "video_folders_tenant_idx" ON "video_folders" USING btree ("tenant_id");
  CREATE INDEX "video_folders_slug_idx" ON "video_folders" USING btree ("slug");
  CREATE INDEX "video_folders_parent_idx" ON "video_folders" USING btree ("parent_id");
  CREATE INDEX "video_folders_updated_at_idx" ON "video_folders" USING btree ("updated_at");
  CREATE INDEX "video_folders_created_at_idx" ON "video_folders" USING btree ("created_at");
  ALTER TABLE "videos" ADD CONSTRAINT "videos_folder_id_video_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."video_folders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_video_folders_fk" FOREIGN KEY ("video_folders_id") REFERENCES "public"."video_folders"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "videos_folder_idx" ON "videos" USING btree ("folder_id");
  CREATE INDEX "payload_locked_documents_rels_video_folders_id_idx" ON "payload_locked_documents_rels" USING btree ("video_folders_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "video_folders_breadcrumbs" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "video_folders" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "video_folders_breadcrumbs" CASCADE;
  DROP TABLE "video_folders" CASCADE;
  ALTER TABLE "videos" DROP CONSTRAINT "videos_folder_id_video_folders_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_video_folders_fk";
  
  DROP INDEX "videos_folder_idx";
  DROP INDEX "payload_locked_documents_rels_video_folders_id_idx";
  ALTER TABLE "videos" DROP COLUMN "folder_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "video_folders_id";`)
}
