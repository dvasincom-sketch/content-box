import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Телефон как основной ID автора: вход по SMS-коду (OTP). phone уникален
 * глобально (users — auth-коллекция, как email). Частичный уникальный индекс —
 * чтобы NULL-телефоны (старые email-авторы) не конфликтовали.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "phone" varchar;
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "phone_verified" boolean DEFAULT false;
    CREATE UNIQUE INDEX IF NOT EXISTS "users_phone_uidx" ON "users" ("phone") WHERE "phone" IS NOT NULL;`)
}
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "users_phone_uidx";
    ALTER TABLE "users" DROP COLUMN IF EXISTS "phone_verified";
    ALTER TABLE "users" DROP COLUMN IF EXISTS "phone";`)
}
