import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Блокировка комментирования: subscribers.comments_banned (доступ к контенту
 * при этом сохраняется). Идемпотентно.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "subscribers" ADD COLUMN IF NOT EXISTS "comments_banned" boolean DEFAULT false;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "subscribers" DROP COLUMN IF EXISTS "comments_banned";`)
}
