import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Мягкое подтверждение email подписчика.
 *
 * subscribers: email_verified (флаг), email_verify_token (одноразовый токен
 *              из письма), email_verify_expiry (срок действия ссылки).
 *
 * «Мягкое» = не блокирует вход. Поля только фиксируют факт подтверждения.
 *
 * Типы выверены по снапшоту subscribers:
 *   checkbox → boolean, text → varchar, date → timestamp(3) with time zone.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "subscribers" ADD COLUMN "email_verified" boolean DEFAULT false;
  ALTER TABLE "subscribers" ADD COLUMN "email_verify_token" varchar;
  ALTER TABLE "subscribers" ADD COLUMN "email_verify_expiry" timestamp(3) with time zone;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "subscribers" DROP COLUMN "email_verified";
  ALTER TABLE "subscribers" DROP COLUMN "email_verify_token";
  ALTER TABLE "subscribers" DROP COLUMN "email_verify_expiry";`)
}
