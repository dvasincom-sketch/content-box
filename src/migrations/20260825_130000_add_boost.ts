import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Boost-транскодинг Ф0: аренда мощного сервера Timeweb по API под прогон очереди.
 *
 * Аккаунт Timeweb — ПЛАТФОРМЕННЫЙ (арендует площадка, автор платит из своего
 * депозита). Поэтому токен и конфиг Timeweb живут в ENV (платформенный секрет),
 * а в БД — только:
 *  - boost_runs — «сырая» операционная таблица (как video_jobs): жизненный цикл
 *    арендованного сервера + сверка стоимости. Доступ через sqlRows.
 *  - site_settings.boost_deposit_rub — депозит тенанта на boost (по образцу ai_deposit_rub).
 *
 * DDL идемпотентный (IF NOT EXISTS) — managed-БД Timeweb иногда рвёт соединение.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "boost_runs" (
      "id" serial PRIMARY KEY NOT NULL,
      "tenant_id" integer,
      "timeweb_server_id" varchar,
      "preset_id" varchar,
      "server_ip" varchar,
      "replicas" integer DEFAULT 0,
      "status" varchar DEFAULT 'provisioning' NOT NULL,
      "est_rub" numeric DEFAULT 0,
      "actual_rub" numeric,
      "hours_billed" numeric,
      "price_per_hour" numeric DEFAULT 0,
      "last_nonempty_at" timestamp(3) with time zone,
      "active_at" timestamp(3) with time zone,
      "deleted_at" timestamp(3) with time zone,
      "error" text,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
    CREATE INDEX IF NOT EXISTS "boost_runs_tenant_idx" ON "boost_runs" USING btree ("tenant_id");
    CREATE INDEX IF NOT EXISTS "boost_runs_status_idx" ON "boost_runs" USING btree ("status");

    ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "boost_deposit_rub" numeric DEFAULT 0;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "boost_runs";
    ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "boost_deposit_rub";`)
}
