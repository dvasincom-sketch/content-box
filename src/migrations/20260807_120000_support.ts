import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * «Поддержать проект»: коллекции support-goals (таблица support_goals) и
 * support-payments (таблица support_payments). По образцу subscription_events:
 * связи на tenants/users (ON DELETE set null), enum статуса платежа, timestamps,
 * проводка в payload_locked_documents_rels. Вручную (нет .json-снимков схемы).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  CREATE TYPE "public"."enum_support_payments_status" AS ENUM('pending', 'succeeded', 'canceled');

  CREATE TABLE "support_goals" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer,
  	"title" varchar,
  	"description" varchar,
  	"target_rub" numeric,
  	"raised_rub" numeric DEFAULT 0,
  	"weight" numeric DEFAULT 0,
  	"is_active" boolean DEFAULT true,
  	"slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "support_payments" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer,
  	"goal_id" integer,
  	"user_id" integer,
  	"display_name" varchar,
  	"amount_rub" numeric,
  	"message" varchar,
  	"is_anonymous" boolean DEFAULT false,
  	"status" "enum_support_payments_status" DEFAULT 'succeeded',
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "support_goals_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "support_payments_id" integer;

  ALTER TABLE "support_goals" ADD CONSTRAINT "support_goals_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "support_payments" ADD CONSTRAINT "support_payments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "support_payments" ADD CONSTRAINT "support_payments_goal_id_support_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."support_goals"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "support_payments" ADD CONSTRAINT "support_payments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;

  CREATE INDEX "support_goals_tenant_idx" ON "support_goals" USING btree ("tenant_id");
  CREATE INDEX "support_goals_slug_idx" ON "support_goals" USING btree ("slug");
  CREATE INDEX "support_goals_updated_at_idx" ON "support_goals" USING btree ("updated_at");
  CREATE INDEX "support_goals_created_at_idx" ON "support_goals" USING btree ("created_at");

  CREATE INDEX "support_payments_tenant_idx" ON "support_payments" USING btree ("tenant_id");
  CREATE INDEX "support_payments_goal_idx" ON "support_payments" USING btree ("goal_id");
  CREATE INDEX "support_payments_user_idx" ON "support_payments" USING btree ("user_id");
  CREATE INDEX "support_payments_updated_at_idx" ON "support_payments" USING btree ("updated_at");
  CREATE INDEX "support_payments_created_at_idx" ON "support_payments" USING btree ("created_at");

  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_support_goals_fk" FOREIGN KEY ("support_goals_id") REFERENCES "public"."support_goals"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_support_payments_fk" FOREIGN KEY ("support_payments_id") REFERENCES "public"."support_payments"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_support_goals_id_idx" ON "payload_locked_documents_rels" USING btree ("support_goals_id");
  CREATE INDEX "payload_locked_documents_rels_support_payments_id_idx" ON "payload_locked_documents_rels" USING btree ("support_payments_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "support_payments" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "support_goals" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "support_payments" CASCADE;
  DROP TABLE "support_goals" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "support_payments_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "support_goals_id";
  DROP TYPE IF EXISTS "public"."enum_support_payments_status";`)
}
