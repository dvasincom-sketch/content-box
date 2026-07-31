import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Баг-баунти: коллекция bug-reports + два новых типа события репутации
 * (`bug_submitted`, `bug_confirmed`) в enum activity_events.
 *
 * Вручную (нет свежих .json-снимков схемы — автогенератор пересоздаёт полбазы).
 * Таблица по образцу submissions/activity_events: enum-поля, связи на
 * tenants/subscribers (ON DELETE set null), timestamps, проводка в
 * payload_locked_documents_rels. ADD VALUE — идемпотентно (IF NOT EXISTS),
 * значения в этой же миграции не используются, поэтому PG16 добавляет их без
 * проблем.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_activity_events_type" ADD VALUE IF NOT EXISTS 'bug_submitted';
  ALTER TYPE "public"."enum_activity_events_type" ADD VALUE IF NOT EXISTS 'bug_confirmed';

  CREATE TYPE "public"."enum_bug_reports_source" AS ENUM('site', 'studio');
  CREATE TYPE "public"."enum_bug_reports_status" AS ENUM('new', 'confirmed', 'duplicate', 'rejected', 'fixed');
  CREATE TYPE "public"."enum_bug_reports_severity" AS ENUM('minor', 'major', 'critical');

  CREATE TABLE "bug_reports" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer,
  	"description" varchar NOT NULL,
  	"page_url" varchar NOT NULL,
  	"page_title" varchar,
  	"subscriber_id" integer,
  	"reporter_user_id" integer,
  	"anonymous" boolean DEFAULT false,
  	"source" "enum_bug_reports_source",
  	"status" "enum_bug_reports_status" DEFAULT 'new' NOT NULL,
  	"severity" "enum_bug_reports_severity",
  	"moderator_note" varchar,
  	"user_agent" varchar,
  	"viewport" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "bug_reports_id" integer;
  ALTER TABLE "bug_reports" ADD CONSTRAINT "bug_reports_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "bug_reports" ADD CONSTRAINT "bug_reports_subscriber_id_subscribers_id_fk" FOREIGN KEY ("subscriber_id") REFERENCES "public"."subscribers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "bug_reports" ADD CONSTRAINT "bug_reports_reporter_user_id_users_id_fk" FOREIGN KEY ("reporter_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "bug_reports_tenant_idx" ON "bug_reports" USING btree ("tenant_id");
  CREATE INDEX "bug_reports_subscriber_idx" ON "bug_reports" USING btree ("subscriber_id");
  CREATE INDEX "bug_reports_reporter_user_idx" ON "bug_reports" USING btree ("reporter_user_id");
  CREATE INDEX "bug_reports_status_idx" ON "bug_reports" USING btree ("status");
  CREATE INDEX "bug_reports_updated_at_idx" ON "bug_reports" USING btree ("updated_at");
  CREATE INDEX "bug_reports_created_at_idx" ON "bug_reports" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_bug_reports_fk" FOREIGN KEY ("bug_reports_id") REFERENCES "public"."bug_reports"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_bug_reports_id_idx" ON "payload_locked_documents_rels" USING btree ("bug_reports_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // enum activity_events НЕ откатываем: удалить значение из PG-enum нельзя без
  // пересоздания типа, а новые значения безвредны.
  await db.execute(sql`
   ALTER TABLE "bug_reports" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "bug_reports" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_bug_reports_fk";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_bug_reports_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "bug_reports_id";
  DROP TYPE "public"."enum_bug_reports_source";
  DROP TYPE "public"."enum_bug_reports_status";
  DROP TYPE "public"."enum_bug_reports_severity";`)
}
