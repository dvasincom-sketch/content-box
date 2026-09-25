import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Трансляции: модераторы чата (streams.moderator_emails, jsonb — массив email).
 * Идемпотентно.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "streams" ADD COLUMN IF NOT EXISTS "moderator_emails" jsonb;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "streams" DROP COLUMN IF EXISTS "moderator_emails";`)
}
