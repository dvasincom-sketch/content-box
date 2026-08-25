import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Конфиг boost — «сырая» таблица-синглтон (одна строка id=1), редактируется в
 * студийной панели без редеплоя. НАМЕРЕННО отдельно от site_settings: если эта
 * миграция когда-нибудь не доедет (у managed-Postgres бывают обрывы), сломается
 * только boost, а не вся страница настроек. Секрет (TIMEWEB_TOKEN) — в env, не тут.
 *
 * DDL идемпотентный (IF NOT EXISTS).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "boost_config" (
      "id" integer PRIMARY KEY NOT NULL,
      "enabled" boolean DEFAULT false,
      "preset_id" varchar,
      "image_id" varchar,
      "os_id" integer,
      "location" varchar,
      "replicas" integer,
      "cpus_per_worker" integer,
      "margin_pct" numeric,
      "max_lifetime_min" integer,
      "idle_minutes" integer,
      "throughput_per_hour" integer,
      "whisper_enabled" boolean,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
    INSERT INTO "boost_config" ("id") VALUES (1) ON CONFLICT ("id") DO NOTHING;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`DROP TABLE IF EXISTS "boost_config";`)
}
