import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Письма об окончании подписки: отметки «для какой даты окончания уже
 * написали» — subscribers.expiry_reminder_for (за 3 дня) и
 * subscribers.expiry_notice_for (подписка закончилась). Идемпотентно.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "subscribers" ADD COLUMN IF NOT EXISTS "expiry_reminder_for" timestamp(3) with time zone;
    ALTER TABLE "subscribers" ADD COLUMN IF NOT EXISTS "expiry_notice_for" timestamp(3) with time zone;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "subscribers" DROP COLUMN IF EXISTS "expiry_reminder_for";
    ALTER TABLE "subscribers" DROP COLUMN IF EXISTS "expiry_notice_for";`)
}
