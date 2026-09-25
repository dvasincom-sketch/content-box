import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Чат трансляций: закрепление сообщения (stream_messages.pinned) и бан
 * пользователя в чате (subscribers.chat_banned). Идемпотентные ADD COLUMN.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "stream_messages" ADD COLUMN IF NOT EXISTS "pinned" boolean DEFAULT false;
    ALTER TABLE "subscribers" ADD COLUMN IF NOT EXISTS "chat_banned" boolean DEFAULT false;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "stream_messages" DROP COLUMN IF EXISTS "pinned";
    ALTER TABLE "subscribers" DROP COLUMN IF EXISTS "chat_banned";`)
}
