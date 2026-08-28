import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Подарочные подписки — «сырая» таблица промокодов (как video_jobs/boost_runs).
 * Покупатель оплачивает N месяцев уровня для получателя по e-mail → после оплаты
 * код активируется и уходит письмом → получатель активирует его на сайте
 * (продлевается его подписка). Доступ через sqlRows. DDL идемпотентный.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "gift_codes" (
      "id" serial PRIMARY KEY NOT NULL,
      "tenant_id" integer,
      "code" varchar NOT NULL,
      "tier_id" integer,
      "months" integer DEFAULT 1,
      "amount_rub" numeric DEFAULT 0,
      "status" varchar DEFAULT 'pending' NOT NULL,
      "recipient_email" varchar,
      "buyer_name" varchar,
      "yookassa_payment_id" varchar,
      "redeemed_by" integer,
      "redeemed_at" timestamp(3) with time zone,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS "gift_codes_code_uq" ON "gift_codes" USING btree ("code");
    CREATE INDEX IF NOT EXISTS "gift_codes_tenant_idx" ON "gift_codes" USING btree ("tenant_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`DROP TABLE IF EXISTS "gift_codes";`)
}
