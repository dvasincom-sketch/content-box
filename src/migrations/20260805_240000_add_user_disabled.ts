import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Флаг деактивации участника: users.disabled. Отзыв доступа = disabled:true
 * (аккаунт и авторство контента сохраняются, но вход и студия закрыты).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "users" ADD COLUMN "disabled" boolean DEFAULT false;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "users" DROP COLUMN IF EXISTS "disabled";`)
}
