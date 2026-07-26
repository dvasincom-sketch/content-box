import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * activity-events — журнал начислений очков репутации (Фаза 2 «Сообщество»).
 * Тенант-скоуп коллекция с enum type, связями на subscribers/tenants,
 * timestamps и проводкой в payload_locked_documents_rels — по образцу
 * comments/reactions.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_activity_events_type" AS ENUM('comment', 'reaction_received');
  CREATE TABLE "activity_events" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer,
  	"subscriber_id" integer NOT NULL,
  	"type" "enum_activity_events_type" NOT NULL,
  	"points" numeric NOT NULL,
  	"ref_type" varchar,
  	"ref_id" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "activity_events_id" integer;
  ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_subscriber_id_subscribers_id_fk" FOREIGN KEY ("subscriber_id") REFERENCES "public"."subscribers"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "activity_events_tenant_idx" ON "activity_events" USING btree ("tenant_id");
  CREATE INDEX "activity_events_subscriber_idx" ON "activity_events" USING btree ("subscriber_id");
  CREATE INDEX "activity_events_ref_idx" ON "activity_events" USING btree ("type","ref_type","ref_id");
  CREATE INDEX "activity_events_updated_at_idx" ON "activity_events" USING btree ("updated_at");
  CREATE INDEX "activity_events_created_at_idx" ON "activity_events" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_activity_events_fk" FOREIGN KEY ("activity_events_id") REFERENCES "public"."activity_events"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_activity_events_id_idx" ON "payload_locked_documents_rels" USING btree ("activity_events_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "activity_events" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "activity_events" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_activity_events_fk";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_activity_events_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "activity_events_id";
  DROP TYPE "public"."enum_activity_events_type";`)
}
