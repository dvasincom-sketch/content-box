import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * ai-usage — журнал вызовов Аси по тенанту (поверхность + токены) для вкладки
 * «AI» в настройках. Тенант-скоуп коллекция с enum поверхности, timestamps и
 * проводкой в payload_locked_documents_rels — по образцу activity-events.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_ai_usage_surface" AS ENUM('compose', 'summary', 'support');
  CREATE TABLE "ai_usage" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer,
  	"surface" "enum_ai_usage_surface" NOT NULL,
  	"action" varchar,
  	"tokens_in" numeric DEFAULT 0,
  	"tokens_out" numeric DEFAULT 0,
  	"tokens_total" numeric DEFAULT 0,
  	"estimated" boolean DEFAULT true,
  	"ok" boolean DEFAULT true,
  	"actor_type" varchar,
  	"meta" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "ai_usage_id" integer;
  ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "ai_usage_tenant_idx" ON "ai_usage" USING btree ("tenant_id");
  CREATE INDEX "ai_usage_surface_idx" ON "ai_usage" USING btree ("surface");
  CREATE INDEX "ai_usage_tokens_total_idx" ON "ai_usage" USING btree ("tokens_total");
  CREATE INDEX "ai_usage_created_at_idx" ON "ai_usage" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_ai_usage_fk" FOREIGN KEY ("ai_usage_id") REFERENCES "public"."ai_usage"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_ai_usage_id_idx" ON "payload_locked_documents_rels" USING btree ("ai_usage_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "ai_usage" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "ai_usage" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_ai_usage_fk";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_ai_usage_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "ai_usage_id";
  DROP TYPE "public"."enum_ai_usage_surface";`)
}
