import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * digest-issues — история выпусков дайджеста по тенанту + отклик (открытия/клики),
 * собственный трекинг без Listmonk. Тенант-скоуп коллекция с timestamps и
 * проводкой в payload_locked_documents_rels — по образцу ai-usage.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "digest_issues" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer,
  	"subject" varchar NOT NULL,
  	"html" varchar,
  	"sent_at" timestamp(3) with time zone,
  	"recipients" numeric DEFAULT 0,
  	"items_count" numeric DEFAULT 0,
  	"opens" numeric DEFAULT 0,
  	"clicks" numeric DEFAULT 0,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "digest_issues_id" integer;
  ALTER TABLE "digest_issues" ADD CONSTRAINT "digest_issues_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "digest_issues_tenant_idx" ON "digest_issues" USING btree ("tenant_id");
  CREATE INDEX "digest_issues_sent_at_idx" ON "digest_issues" USING btree ("sent_at");
  CREATE INDEX "digest_issues_created_at_idx" ON "digest_issues" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_digest_issues_fk" FOREIGN KEY ("digest_issues_id") REFERENCES "public"."digest_issues"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_digest_issues_id_idx" ON "payload_locked_documents_rels" USING btree ("digest_issues_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "digest_issues" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "digest_issues" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_digest_issues_fk";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_digest_issues_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "digest_issues_id";`)
}
