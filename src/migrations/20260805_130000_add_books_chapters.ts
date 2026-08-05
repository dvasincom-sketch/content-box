import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * «Книги» + «Главы» — авторский текстовый контент (Фаза A: данные).
 *
 * Вручную (нет свежих .json-снимков схемы). Таблицы по образцу publications
 * (richText → jsonb, cover → cover_id, теги → <table>_tags: _order/_parent_id/
 * id/label/slug), связи на tenants/media/categories/subscription_tiers
 * (ON DELETE set null), timestamps, проводка в payload_locked_documents_rels.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_books_status" AS ENUM('ongoing', 'finished', 'frozen');

  CREATE TABLE "books" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer,
  	"title" varchar NOT NULL,
  	"slug" varchar,
  	"cover_id" integer,
  	"annotation" jsonb,
  	"status" "enum_books_status" DEFAULT 'ongoing',
  	"is_adult" boolean DEFAULT false,
  	"category_id" integer,
  	"min_tier_id" integer,
  	"free_chapters" numeric DEFAULT 0,
  	"published_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "books_tags" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"slug" varchar
  );

  CREATE TABLE "chapters" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer,
  	"book_id" integer,
  	"order" numeric DEFAULT 1,
  	"title" varchar NOT NULL,
  	"body" jsonb,
  	"is_preview" boolean DEFAULT false,
  	"min_tier_id" integer,
  	"word_count" numeric,
  	"published_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "books_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "chapters_id" integer;

  ALTER TABLE "books" ADD CONSTRAINT "books_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "books" ADD CONSTRAINT "books_cover_id_media_id_fk" FOREIGN KEY ("cover_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "books" ADD CONSTRAINT "books_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "books" ADD CONSTRAINT "books_min_tier_id_subscription_tiers_id_fk" FOREIGN KEY ("min_tier_id") REFERENCES "public"."subscription_tiers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "books_tags" ADD CONSTRAINT "books_tags_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "chapters" ADD CONSTRAINT "chapters_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "chapters" ADD CONSTRAINT "chapters_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "chapters" ADD CONSTRAINT "chapters_min_tier_id_subscription_tiers_id_fk" FOREIGN KEY ("min_tier_id") REFERENCES "public"."subscription_tiers"("id") ON DELETE set null ON UPDATE no action;

  CREATE INDEX "books_tenant_idx" ON "books" USING btree ("tenant_id");
  CREATE INDEX "books_cover_idx" ON "books" USING btree ("cover_id");
  CREATE INDEX "books_category_idx" ON "books" USING btree ("category_id");
  CREATE INDEX "books_min_tier_idx" ON "books" USING btree ("min_tier_id");
  CREATE INDEX "books_slug_idx" ON "books" USING btree ("slug");
  CREATE INDEX "books_updated_at_idx" ON "books" USING btree ("updated_at");
  CREATE INDEX "books_created_at_idx" ON "books" USING btree ("created_at");
  CREATE INDEX "books_tags_order_idx" ON "books_tags" USING btree ("_order");
  CREATE INDEX "books_tags_parent_id_idx" ON "books_tags" USING btree ("_parent_id");
  CREATE INDEX "books_tags_slug_idx" ON "books_tags" USING btree ("slug");
  CREATE INDEX "chapters_tenant_idx" ON "chapters" USING btree ("tenant_id");
  CREATE INDEX "chapters_book_idx" ON "chapters" USING btree ("book_id");
  CREATE INDEX "chapters_min_tier_idx" ON "chapters" USING btree ("min_tier_id");
  CREATE INDEX "chapters_updated_at_idx" ON "chapters" USING btree ("updated_at");
  CREATE INDEX "chapters_created_at_idx" ON "chapters" USING btree ("created_at");

  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_books_fk" FOREIGN KEY ("books_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_chapters_fk" FOREIGN KEY ("chapters_id") REFERENCES "public"."chapters"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_books_id_idx" ON "payload_locked_documents_rels" USING btree ("books_id");
  CREATE INDEX "payload_locked_documents_rels_chapters_id_idx" ON "payload_locked_documents_rels" USING btree ("chapters_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "books_tags" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "chapters" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "books" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "books_tags" CASCADE;
  DROP TABLE "chapters" CASCADE;
  DROP TABLE "books" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_books_fk";
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_chapters_fk";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_books_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_chapters_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "books_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "chapters_id";
  DROP TYPE "public"."enum_books_status";`)
}
