import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Трансляции: открытый эфир без подписки (streams.is_open). Идемпотентно.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "streams" ADD COLUMN IF NOT EXISTS "is_open" boolean DEFAULT false;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "streams" DROP COLUMN IF EXISTS "is_open";`)
}
