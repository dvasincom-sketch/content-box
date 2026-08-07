import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * subscribers.lastSeenAt — момент последнего входа зрителя. Заполняется
 * хуком afterLogin (fire-and-forget), чтобы в дашборде показывать «был(а)…».
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "subscribers" ADD COLUMN IF NOT EXISTS "last_seen_at" timestamp(3) with time zone;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "subscribers" DROP COLUMN IF EXISTS "last_seen_at";`)
}
