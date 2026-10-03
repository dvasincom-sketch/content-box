import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * asya-questions — журнал диалогов с Асей (вопрос/ответ/найденные видео/оценка)
 * для обратной связи владельцу. Тенант-скоуп коллекция с enum оценки, связью на
 * подписчика, jsonb для найденных видео, timestamps и проводкой в
 * payload_locked_documents_rels — по образцу ai-usage.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   DO $$ BEGIN
     CREATE TYPE "public"."enum_asya_questions_rating" AS ENUM('up', 'down');
   EXCEPTION WHEN duplicate_object THEN null; END $$;
  CREATE TABLE IF NOT EXISTS "asya_questions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer,
  	"question" varchar NOT NULL,
  	"answer" varchar,
  	"matches" jsonb,
  	"had_matches" boolean DEFAULT false,
  	"context" varchar,
  	"subscriber_id" integer,
  	"rating" "enum_asya_questions_rating",
  	"rating_comment" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "asya_questions_id" integer;
  DO $$ BEGIN
    ALTER TABLE "asya_questions" ADD CONSTRAINT "asya_questions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$;
  DO $$ BEGIN
    ALTER TABLE "asya_questions" ADD CONSTRAINT "asya_questions_subscriber_id_subscribers_id_fk" FOREIGN KEY ("subscriber_id") REFERENCES "public"."subscribers"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$;
  CREATE INDEX IF NOT EXISTS "asya_questions_tenant_idx" ON "asya_questions" USING btree ("tenant_id");
  CREATE INDEX IF NOT EXISTS "asya_questions_had_matches_idx" ON "asya_questions" USING btree ("had_matches");
  CREATE INDEX IF NOT EXISTS "asya_questions_subscriber_idx" ON "asya_questions" USING btree ("subscriber_id");
  CREATE INDEX IF NOT EXISTS "asya_questions_created_at_idx" ON "asya_questions" USING btree ("created_at");
  DO $$ BEGIN
    ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_asya_questions_fk" FOREIGN KEY ("asya_questions_id") REFERENCES "public"."asya_questions"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$;
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_asya_questions_id_idx" ON "payload_locked_documents_rels" USING btree ("asya_questions_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "asya_questions" DISABLE ROW LEVEL SECURITY;
  DROP TABLE IF EXISTS "asya_questions" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_asya_questions_fk";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_asya_questions_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "asya_questions_id";
  DROP TYPE IF EXISTS "public"."enum_asya_questions_rating";`)
}
