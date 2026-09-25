import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Чат трансляций — коллекция stream_messages (по образцу streams/downloads).
 * stream_id → cascade (удаляем сообщения вместе с трансляцией),
 * subscriber_id → set null. Проводка в payload_locked_documents_rels.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "stream_messages" (
    "id" serial PRIMARY KEY NOT NULL,
    "tenant_id" integer,
    "stream_id" integer,
    "subscriber_id" integer,
    "name" varchar,
    "text" varchar NOT NULL,
    "hidden" boolean DEFAULT false,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "stream_messages_id" integer;
  ALTER TABLE "stream_messages" ADD CONSTRAINT "stream_messages_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "stream_messages" ADD CONSTRAINT "stream_messages_stream_id_streams_id_fk" FOREIGN KEY ("stream_id") REFERENCES "public"."streams"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "stream_messages" ADD CONSTRAINT "stream_messages_subscriber_id_subscribers_id_fk" FOREIGN KEY ("subscriber_id") REFERENCES "public"."subscribers"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "stream_messages_tenant_idx" ON "stream_messages" USING btree ("tenant_id");
  CREATE INDEX "stream_messages_stream_idx" ON "stream_messages" USING btree ("stream_id");
  CREATE INDEX "stream_messages_subscriber_idx" ON "stream_messages" USING btree ("subscriber_id");
  CREATE INDEX "stream_messages_created_at_idx" ON "stream_messages" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_stream_messages_fk" FOREIGN KEY ("stream_messages_id") REFERENCES "public"."stream_messages"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_stream_messages_id_idx" ON "payload_locked_documents_rels" USING btree ("stream_messages_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "stream_messages" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "stream_messages" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_stream_messages_fk";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_stream_messages_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "stream_messages_id";`)
}
