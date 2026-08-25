import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Boost-настройки как Payload-коллекция `boost-settings` (правит суперадмин в
 * админке). Заменяет «сырую» boost_config (её студийную форму убрали — автор не
 * должен задавать пресет/маржу). Таблица под форму Payload + связь в
 * payload_locked_documents_rels. DDL идемпотентный.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "boost_settings" (
      "id" serial PRIMARY KEY NOT NULL,
      "enabled" boolean DEFAULT false,
      "preset_id" varchar,
      "image_id" varchar,
      "os_id" numeric,
      "location" varchar,
      "replicas" numeric,
      "cpus_per_worker" numeric DEFAULT 7,
      "margin_pct" numeric DEFAULT 30,
      "max_lifetime_min" numeric DEFAULT 180,
      "idle_minutes" numeric DEFAULT 10,
      "throughput_per_hour" numeric DEFAULT 20,
      "whisper_enabled" boolean DEFAULT true,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "boost_settings_id" integer;
    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_boost_settings_fk" FOREIGN KEY ("boost_settings_id") REFERENCES "public"."boost_settings"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_boost_settings_id_idx" ON "payload_locked_documents_rels" USING btree ("boost_settings_id");

    -- Старая «сырая» таблица конфига больше не нужна (студийную форму убрали).
    DROP TABLE IF EXISTS "boost_config";`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_boost_settings_fk";
    DROP INDEX IF EXISTS "payload_locked_documents_rels_boost_settings_id_idx";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "boost_settings_id";
    DROP TABLE IF EXISTS "boost_settings";`)
}
