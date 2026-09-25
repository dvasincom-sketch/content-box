import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Streams — прямые трансляции (Castr). Коллекция Payload: таблица по образцу
 * downloads (tenant/owner/relationships → *_id, timestamps, проводка в
 * payload_locked_documents_rels). Названия колонок — как их выводит Payload из
 * полей коллекции (camelCase → snake_case).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "streams" (
    "id" serial PRIMARY KEY NOT NULL,
    "tenant_id" integer,
    "owner_id" integer,
    "title" varchar NOT NULL,
    "slug" varchar NOT NULL,
    "scheduled_at" timestamp(3) with time zone,
    "ends_at" timestamp(3) with time zone,
    "cover_id" integer,
    "min_tier_id" integer,
    "chat_enabled" boolean DEFAULT true,
    "save_recording" boolean DEFAULT false,
    "playback_url" varchar,
    "ingest_server" varchar,
    "ingest_key" varchar,
    "recording_url" varchar,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "streams_id" integer;
  ALTER TABLE "streams" ADD CONSTRAINT "streams_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "streams" ADD CONSTRAINT "streams_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "streams" ADD CONSTRAINT "streams_cover_id_media_id_fk" FOREIGN KEY ("cover_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "streams" ADD CONSTRAINT "streams_min_tier_id_subscription_tiers_id_fk" FOREIGN KEY ("min_tier_id") REFERENCES "public"."subscription_tiers"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "streams_tenant_idx" ON "streams" USING btree ("tenant_id");
  CREATE INDEX "streams_owner_idx" ON "streams" USING btree ("owner_id");
  CREATE INDEX "streams_cover_idx" ON "streams" USING btree ("cover_id");
  CREATE INDEX "streams_min_tier_idx" ON "streams" USING btree ("min_tier_id");
  CREATE INDEX "streams_slug_idx" ON "streams" USING btree ("slug");
  CREATE INDEX "streams_updated_at_idx" ON "streams" USING btree ("updated_at");
  CREATE INDEX "streams_created_at_idx" ON "streams" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_streams_fk" FOREIGN KEY ("streams_id") REFERENCES "public"."streams"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_streams_id_idx" ON "payload_locked_documents_rels" USING btree ("streams_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "streams" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "streams" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_streams_fk";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_streams_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "streams_id";`)
}
