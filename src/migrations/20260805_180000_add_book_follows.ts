import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * «Следить за книгой» — коллекция book_follows (читатель → книга). Уникальность
 * пары держит unique-индекс. Проводка в payload_locked_documents_rels.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "book_follows" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer,
  	"subscriber_id" integer NOT NULL,
  	"book_id" integer NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "book_follows_id" integer;
  ALTER TABLE "book_follows" ADD CONSTRAINT "book_follows_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "book_follows" ADD CONSTRAINT "book_follows_subscriber_id_subscribers_id_fk" FOREIGN KEY ("subscriber_id") REFERENCES "public"."subscribers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "book_follows" ADD CONSTRAINT "book_follows_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "book_follows_tenant_idx" ON "book_follows" USING btree ("tenant_id");
  CREATE INDEX "book_follows_subscriber_idx" ON "book_follows" USING btree ("subscriber_id");
  CREATE INDEX "book_follows_book_idx" ON "book_follows" USING btree ("book_id");
  CREATE UNIQUE INDEX "book_follows_pair_idx" ON "book_follows" USING btree ("subscriber_id","book_id");
  CREATE INDEX "book_follows_updated_at_idx" ON "book_follows" USING btree ("updated_at");
  CREATE INDEX "book_follows_created_at_idx" ON "book_follows" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_book_follows_fk" FOREIGN KEY ("book_follows_id") REFERENCES "public"."book_follows"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_book_follows_id_idx" ON "payload_locked_documents_rels" USING btree ("book_follows_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "book_follows" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "book_follows" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_book_follows_fk";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_book_follows_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "book_follows_id";`)
}
