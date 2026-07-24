import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Дайджест-уведомления подписчикам.
 *
 * subscribers:   notify_digest (согласие на дайджест, по умолч. true),
 *                unsubscribe_token (токен ссылки «отписаться» из письма).
 * site_settings: last_digest_at (водяная метка планировщика — до этого
 *                момента материалы уже разосланы).
 *
 * Типы по снапшоту: checkbox → boolean, text → varchar,
 *   date → timestamp(3) with time zone.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "subscribers" ADD COLUMN "notify_digest" boolean DEFAULT true;
  ALTER TABLE "subscribers" ADD COLUMN "unsubscribe_token" varchar;
  ALTER TABLE "site_settings" ADD COLUMN "last_digest_at" timestamp(3) with time zone;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "subscribers" DROP COLUMN "notify_digest";
  ALTER TABLE "subscribers" DROP COLUMN "unsubscribe_token";
  ALTER TABLE "site_settings" DROP COLUMN "last_digest_at";`)
}
