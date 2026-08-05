import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * «Файлы» (downloads) — цифровые товары под подписку. Upload-коллекция в S3.
 *
 * Вручную (нет свежих .json-снимков схемы — автогенератор пересоздаёт полбазы).
 * Таблица по образцу gallery_images (upload-колонки url/filename/mime_type/…),
 * связи на tenants/categories/subscription_tiers (ON DELETE set null),
 * timestamps, проводка в payload_locked_documents_rels (как у bug_reports).
 *
 * Набор upload-колонок берём с запасом (width/height/focal_* — для картинок):
 * лишняя nullable-колонка безвредна, а нехватка ожидаемой Payload колонки —
 * фатальна на первом же запросе. Поэтому дублируем полный набор gallery_images.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "downloads" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer,
  	"title" varchar NOT NULL,
  	"description" varchar,
  	"category_id" integer,
  	"min_tier_id" integer,
  	"is_preview" boolean DEFAULT false,
  	"published_at" timestamp(3) with time zone,
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
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "downloads_id" integer;
  ALTER TABLE "downloads" ADD CONSTRAINT "downloads_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "downloads" ADD CONSTRAINT "downloads_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "downloads" ADD CONSTRAINT "downloads_min_tier_id_subscription_tiers_id_fk" FOREIGN KEY ("min_tier_id") REFERENCES "public"."subscription_tiers"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "downloads_tenant_idx" ON "downloads" USING btree ("tenant_id");
  CREATE INDEX "downloads_category_idx" ON "downloads" USING btree ("category_id");
  CREATE INDEX "downloads_min_tier_idx" ON "downloads" USING btree ("min_tier_id");
  CREATE INDEX "downloads_updated_at_idx" ON "downloads" USING btree ("updated_at");
  CREATE INDEX "downloads_created_at_idx" ON "downloads" USING btree ("created_at");
  CREATE UNIQUE INDEX "downloads_filename_idx" ON "downloads" USING btree ("filename");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_downloads_fk" FOREIGN KEY ("downloads_id") REFERENCES "public"."downloads"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_downloads_id_idx" ON "payload_locked_documents_rels" USING btree ("downloads_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "downloads" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "downloads" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_downloads_fk";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_downloads_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "downloads_id";`)
}
