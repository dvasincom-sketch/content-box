import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Рекуррентные платежи ЮKassa (Вариант 1): креды магазина автора на site_settings,
 * поля автопродления у подписчика и коллекция subscription_payments (история +
 * идемпотентность вебхука). DDL идемпотентный (IF NOT EXISTS / DO-EXCEPTION) —
 * managed-БД Timeweb иногда рвёт соединение посреди миграции.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   DO $$ BEGIN
    CREATE TYPE "public"."enum_site_settings_yookassa_mode" AS ENUM('test', 'live');
   EXCEPTION WHEN duplicate_object THEN null; END $$;

   DO $$ BEGIN
    CREATE TYPE "public"."enum_subscription_payments_status" AS ENUM('pending', 'succeeded', 'canceled', 'refunded');
   EXCEPTION WHEN duplicate_object THEN null; END $$;

  CREATE TABLE IF NOT EXISTS "subscription_payments" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer,
  	"subscriber_id" integer,
  	"tier_id" integer,
  	"amount_rub" numeric DEFAULT 0,
  	"status" "enum_subscription_payments_status" DEFAULT 'pending',
  	"yookassa_payment_id" varchar,
  	"is_recurring" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "yookassa_shop_id" varchar;
  ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "yookassa_secret" varchar;
  ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "yookassa_mode" "enum_site_settings_yookassa_mode" DEFAULT 'test';
  ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "yookassa_tax_system" numeric;
  ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "yookassa_vat_code" numeric DEFAULT 1;

  ALTER TABLE "subscribers" ADD COLUMN IF NOT EXISTS "auto_renew" boolean DEFAULT false;
  ALTER TABLE "subscribers" ADD COLUMN IF NOT EXISTS "yookassa_payment_method_id" varchar;
  ALTER TABLE "subscribers" ADD COLUMN IF NOT EXISTS "card_label" varchar;
  ALTER TABLE "subscribers" ADD COLUMN IF NOT EXISTS "subscription_since" timestamp(3) with time zone;
  ALTER TABLE "subscribers" ADD COLUMN IF NOT EXISTS "last_payment_at" timestamp(3) with time zone;

  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "subscription_payments_id" integer;

  DO $$ BEGIN
    ALTER TABLE "subscription_payments" ADD CONSTRAINT "subscription_payments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$;
  DO $$ BEGIN
    ALTER TABLE "subscription_payments" ADD CONSTRAINT "subscription_payments_subscriber_id_subscribers_id_fk" FOREIGN KEY ("subscriber_id") REFERENCES "public"."subscribers"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$;
  DO $$ BEGIN
    ALTER TABLE "subscription_payments" ADD CONSTRAINT "subscription_payments_tier_id_subscription_tiers_id_fk" FOREIGN KEY ("tier_id") REFERENCES "public"."subscription_tiers"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$;
  DO $$ BEGIN
    ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_subscription_payments_fk" FOREIGN KEY ("subscription_payments_id") REFERENCES "public"."subscription_payments"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$;

  CREATE INDEX IF NOT EXISTS "subscription_payments_tenant_idx" ON "subscription_payments" USING btree ("tenant_id");
  CREATE INDEX IF NOT EXISTS "subscription_payments_subscriber_idx" ON "subscription_payments" USING btree ("subscriber_id");
  CREATE INDEX IF NOT EXISTS "subscription_payments_yookassa_payment_id_idx" ON "subscription_payments" USING btree ("yookassa_payment_id");
  CREATE INDEX IF NOT EXISTS "subscription_payments_created_at_idx" ON "subscription_payments" USING btree ("created_at");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_subscription_payments_id_idx" ON "payload_locked_documents_rels" USING btree ("subscription_payments_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "subscription_payments" DISABLE ROW LEVEL SECURITY;
  DROP TABLE IF EXISTS "subscription_payments" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_subscription_payments_fk";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_subscription_payments_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "subscription_payments_id";
  ALTER TABLE "subscribers" DROP COLUMN IF EXISTS "auto_renew";
  ALTER TABLE "subscribers" DROP COLUMN IF EXISTS "yookassa_payment_method_id";
  ALTER TABLE "subscribers" DROP COLUMN IF EXISTS "card_label";
  ALTER TABLE "subscribers" DROP COLUMN IF EXISTS "subscription_since";
  ALTER TABLE "subscribers" DROP COLUMN IF EXISTS "last_payment_at";
  ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "yookassa_shop_id";
  ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "yookassa_secret";
  ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "yookassa_mode";
  ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "yookassa_tax_system";
  ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "yookassa_vat_code";
  DROP TYPE IF EXISTS "public"."enum_subscription_payments_status";
  DROP TYPE IF EXISTS "public"."enum_site_settings_yookassa_mode";`)
}
