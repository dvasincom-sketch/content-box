import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Журнал событий подписок — коллекция subscription-events (таблица
 * subscription_events). По образцу studio_activity: enum действия, связи на
 * tenants/subscribers/subscription_tiers (ON DELETE set null), снимок
 * цены/названия тарифа, timestamps, проводка в payload_locked_documents_rels.
 * Вручную (нет свежих .json-снимков схемы).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  CREATE TYPE "public"."enum_subscription_events_action" AS ENUM('started', 'renewed', 'changed', 'canceled');
  CREATE TABLE "subscription_events" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer,
  	"subscriber_id" integer,
  	"tier_id" integer,
  	"tier_name" varchar,
  	"price_rub" numeric,
  	"action" "enum_subscription_events_action",
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "subscription_events_id" integer;
  ALTER TABLE "subscription_events" ADD CONSTRAINT "subscription_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "subscription_events" ADD CONSTRAINT "subscription_events_subscriber_id_subscribers_id_fk" FOREIGN KEY ("subscriber_id") REFERENCES "public"."subscribers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "subscription_events" ADD CONSTRAINT "subscription_events_tier_id_subscription_tiers_id_fk" FOREIGN KEY ("tier_id") REFERENCES "public"."subscription_tiers"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "subscription_events_tenant_idx" ON "subscription_events" USING btree ("tenant_id");
  CREATE INDEX "subscription_events_subscriber_idx" ON "subscription_events" USING btree ("subscriber_id");
  CREATE INDEX "subscription_events_action_idx" ON "subscription_events" USING btree ("action");
  CREATE INDEX "subscription_events_created_at_idx" ON "subscription_events" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_subscription_events_fk" FOREIGN KEY ("subscription_events_id") REFERENCES "public"."subscription_events"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_subscription_events_id_idx" ON "payload_locked_documents_rels" USING btree ("subscription_events_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "subscription_events" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "subscription_events" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "subscription_events_id";
  DROP TYPE IF EXISTS "public"."enum_subscription_events_action";`)
}
