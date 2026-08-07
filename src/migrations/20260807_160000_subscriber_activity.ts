import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * subscriber-activity (таблица subscriber_activity) — журнал значимых действий
 * зрителя для таймлайна в дашборде. По образцу subscription_events: enum
 * действия, связи на tenants/subscribers (ON DELETE set null), meta jsonb,
 * timestamps, проводка в payload_locked_documents_rels. Вручную (нет свежих
 * .json-снимков схемы).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  CREATE TYPE "public"."enum_subscriber_activity_action" AS ENUM('login', 'register', 'view', 'comment', 'reaction', 'bookmark', 'follow', 'subscribe', 'unsubscribe', 'subscription_change');
  CREATE TABLE "subscriber_activity" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"subscriber_id" integer,
  	"action" "enum_subscriber_activity_action",
  	"target_type" varchar,
  	"target_id" varchar,
  	"meta" jsonb,
  	"tenant_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "subscriber_activity_id" integer;
  ALTER TABLE "subscriber_activity" ADD CONSTRAINT "subscriber_activity_subscriber_id_subscribers_id_fk" FOREIGN KEY ("subscriber_id") REFERENCES "public"."subscribers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "subscriber_activity" ADD CONSTRAINT "subscriber_activity_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "subscriber_activity_subscriber_idx" ON "subscriber_activity" USING btree ("subscriber_id");
  CREATE INDEX "subscriber_activity_tenant_idx" ON "subscriber_activity" USING btree ("tenant_id");
  CREATE INDEX "subscriber_activity_action_idx" ON "subscriber_activity" USING btree ("action");
  CREATE INDEX "subscriber_activity_created_at_idx" ON "subscriber_activity" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_subscriber_activity_fk" FOREIGN KEY ("subscriber_activity_id") REFERENCES "public"."subscriber_activity"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_subscriber_activity_id_idx" ON "payload_locked_documents_rels" USING btree ("subscriber_activity_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "subscriber_activity" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "subscriber_activity" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "subscriber_activity_id";
  DROP TYPE IF EXISTS "public"."enum_subscriber_activity_action";`)
}
