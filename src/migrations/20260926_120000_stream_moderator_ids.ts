import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Сквозные модераторы чата трансляций: site_settings.stream_moderator_ids
 * (jsonb — массив id подписчиков). Идемпотентно.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "stream_moderator_ids" jsonb;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "stream_moderator_ids";`)
}
