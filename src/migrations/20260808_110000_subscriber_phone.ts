import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Телефон подписчика для входа по SMS. Канонический вид 7XXXXXXXXXX,
 * nullable, с индексом для поиска при верификации кода.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "subscribers" ADD COLUMN IF NOT EXISTS "phone" varchar;
  ALTER TABLE "subscribers" ADD COLUMN IF NOT EXISTS "phone_verified" boolean DEFAULT false;
  CREATE INDEX IF NOT EXISTS "subscribers_phone_idx" ON "subscribers" ("phone");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  DROP INDEX IF EXISTS "subscribers_phone_idx";
  ALTER TABLE "subscribers" DROP COLUMN IF EXISTS "phone_verified";
  ALTER TABLE "subscribers" DROP COLUMN IF EXISTS "phone";`)
}
