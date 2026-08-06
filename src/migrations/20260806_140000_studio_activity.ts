import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Журнал активности студии — коллекция studio-activity (таблица studio_activity).
 * По образцу bug_reports: enum действия, связи на tenants/users (ON DELETE set null),
 * timestamps, проводка в payload_locked_documents_rels. Вручную (нет свежих
 * .json-снимков схемы).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  CREATE TYPE "public"."enum_studio_activity_action" AS ENUM('login', 'create', 'update', 'delete');
  CREATE TABLE "studio_activity" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer,
  	"user_id" integer,
  	"action" "enum_studio_activity_action",
  	"entity" varchar,
  	"title" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "studio_activity_id" integer;
  ALTER TABLE "studio_activity" ADD CONSTRAINT "studio_activity_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "studio_activity" ADD CONSTRAINT "studio_activity_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "studio_activity_tenant_idx" ON "studio_activity" USING btree ("tenant_id");
  CREATE INDEX "studio_activity_user_idx" ON "studio_activity" USING btree ("user_id");
  CREATE INDEX "studio_activity_created_at_idx" ON "studio_activity" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_studio_activity_fk" FOREIGN KEY ("studio_activity_id") REFERENCES "public"."studio_activity"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_studio_activity_id_idx" ON "payload_locked_documents_rels" USING btree ("studio_activity_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "studio_activity" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "studio_activity" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "studio_activity_id";
  DROP TYPE IF EXISTS "public"."enum_studio_activity_action";`)
}
