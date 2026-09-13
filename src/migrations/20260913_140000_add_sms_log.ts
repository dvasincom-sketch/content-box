import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Журнал отправленных SMS (таблица sms_log) — для учёта расходов на sms.ru.
 * Отдельная лёгкая таблица БЕЗ регистрации как коллекции Payload: пишем прямым
 * INSERT (см. src/lib/smsLog.ts), читаем SQL-агрегатом в сводке «Финансы».
 * Поэтому НЕ трогаем payload_locked_documents_rels и не заводим enum.
 *
 * cost_rub — снимок цены на момент отправки (чтобы историческая сумма не
 * «поехала» при смене тарифа sms.ru). tenant_id может быть NULL: вход автора в
 * студию телефоном не привязан к тенанту (авторы глобальны).
 *
 * Идемпотентно (IF NOT EXISTS) — безопасно применять повторно.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  CREATE TABLE IF NOT EXISTS "sms_log" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer,
  	"phone_masked" varchar,
  	"kind" varchar,
  	"status" varchar,
  	"cost_rub" numeric DEFAULT 0,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  CREATE INDEX IF NOT EXISTS "sms_log_tenant_idx" ON "sms_log" USING btree ("tenant_id");
  CREATE INDEX IF NOT EXISTS "sms_log_created_at_idx" ON "sms_log" USING btree ("created_at");
  CREATE INDEX IF NOT EXISTS "sms_log_status_idx" ON "sms_log" USING btree ("status");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`DROP TABLE IF EXISTS "sms_log" CASCADE;`)
}
