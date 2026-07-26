import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * UGC / соавторство (Фаза 4). Коллекция submissions (заявки на модерацию) +
 * publications.author/section. Существующим публикациям section='feed' (бэкофилл
 * через DEFAULT), чтобы фильтр главной ленты не выкидывал legacy-строки.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_submissions_status" AS ENUM('pending', 'approved', 'rejected');
  CREATE TYPE "public"."enum_submissions_section" AS ENUM('feed', 'community');
  CREATE TYPE "public"."enum_publications_section" AS ENUM('feed', 'community');
  CREATE TABLE "submissions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer,
  	"author_id" integer NOT NULL,
  	"title" varchar NOT NULL,
  	"body" jsonb,
  	"category_id" integer,
  	"status" "enum_submissions_status" DEFAULT 'pending' NOT NULL,
  	"section" "enum_submissions_section",
  	"reject_reason" varchar,
  	"reviewed_by_id" integer,
  	"publication_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  ALTER TABLE "publications" ADD COLUMN "author_id" integer;
  ALTER TABLE "publications" ADD COLUMN "section" "enum_publications_section" DEFAULT 'feed';
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "submissions_id" integer;
  ALTER TABLE "submissions" ADD CONSTRAINT "submissions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "submissions" ADD CONSTRAINT "submissions_author_id_subscribers_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."subscribers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "submissions" ADD CONSTRAINT "submissions_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "submissions" ADD CONSTRAINT "submissions_reviewed_by_id_users_id_fk" FOREIGN KEY ("reviewed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "submissions" ADD CONSTRAINT "submissions_publication_id_publications_id_fk" FOREIGN KEY ("publication_id") REFERENCES "public"."publications"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "publications" ADD CONSTRAINT "publications_author_id_subscribers_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."subscribers"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "submissions_tenant_idx" ON "submissions" USING btree ("tenant_id");
  CREATE INDEX "submissions_author_idx" ON "submissions" USING btree ("author_id");
  CREATE INDEX "submissions_category_idx" ON "submissions" USING btree ("category_id");
  CREATE INDEX "submissions_reviewed_by_idx" ON "submissions" USING btree ("reviewed_by_id");
  CREATE INDEX "submissions_publication_idx" ON "submissions" USING btree ("publication_id");
  CREATE INDEX "submissions_updated_at_idx" ON "submissions" USING btree ("updated_at");
  CREATE INDEX "submissions_created_at_idx" ON "submissions" USING btree ("created_at");
  CREATE INDEX "publications_author_idx" ON "publications" USING btree ("author_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_submissions_fk" FOREIGN KEY ("submissions_id") REFERENCES "public"."submissions"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_submissions_id_idx" ON "payload_locked_documents_rels" USING btree ("submissions_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "submissions" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "submissions" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_submissions_fk";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_submissions_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "submissions_id";
  ALTER TABLE "publications" DROP CONSTRAINT IF EXISTS "publications_author_id_subscribers_id_fk";
  DROP INDEX IF EXISTS "publications_author_idx";
  ALTER TABLE "publications" DROP COLUMN "author_id";
  ALTER TABLE "publications" DROP COLUMN "section";
  DROP TYPE "public"."enum_submissions_status";
  DROP TYPE "public"."enum_submissions_section";
  DROP TYPE "public"."enum_publications_section";`)
}
