import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Понижение уровня «со следующего периода»: колонка subscribers.pending_tier_id.
 * Зеркалит active_tier_id (индекс + FK set null). DDL идемпотентный —
 * на случай обрыва соединения с Timeweb Postgres во время migrate его можно
 * применить и вручную (IF NOT EXISTS / DO-guard).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "subscribers" ADD COLUMN IF NOT EXISTS "pending_tier_id" integer;
    CREATE INDEX IF NOT EXISTS "subscribers_pending_tier_idx" ON "subscribers" USING btree ("pending_tier_id");
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'subscribers_pending_tier_id_subscription_tiers_id_fk'
      ) THEN
        ALTER TABLE "subscribers"
          ADD CONSTRAINT "subscribers_pending_tier_id_subscription_tiers_id_fk"
          FOREIGN KEY ("pending_tier_id") REFERENCES "public"."subscription_tiers"("id")
          ON DELETE set null ON UPDATE no action;
      END IF;
    END $$;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "subscribers" DROP CONSTRAINT IF EXISTS "subscribers_pending_tier_id_subscription_tiers_id_fk";
    DROP INDEX IF EXISTS "subscribers_pending_tier_idx";
    ALTER TABLE "subscribers" DROP COLUMN IF EXISTS "pending_tier_id";`)
}
