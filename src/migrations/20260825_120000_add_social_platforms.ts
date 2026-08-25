import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Новые площадки соцсетей (TikTok, X, Facebook, Одноклассники, Дзен, RUTUBE,
 * Twitch, Discord, WhatsApp) — добавляем значения в enum
 * enum_site_settings_socials_platform. ADD VALUE IF NOT EXISTS — идемпотентно;
 * значения в enum-типе PostgreSQL не используются в этой же миграции, поэтому
 * транзакция не мешает.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_site_settings_socials_platform" ADD VALUE IF NOT EXISTS 'tiktok';
   ALTER TYPE "public"."enum_site_settings_socials_platform" ADD VALUE IF NOT EXISTS 'x';
   ALTER TYPE "public"."enum_site_settings_socials_platform" ADD VALUE IF NOT EXISTS 'facebook';
   ALTER TYPE "public"."enum_site_settings_socials_platform" ADD VALUE IF NOT EXISTS 'ok';
   ALTER TYPE "public"."enum_site_settings_socials_platform" ADD VALUE IF NOT EXISTS 'dzen';
   ALTER TYPE "public"."enum_site_settings_socials_platform" ADD VALUE IF NOT EXISTS 'rutube';
   ALTER TYPE "public"."enum_site_settings_socials_platform" ADD VALUE IF NOT EXISTS 'twitch';
   ALTER TYPE "public"."enum_site_settings_socials_platform" ADD VALUE IF NOT EXISTS 'discord';
   ALTER TYPE "public"."enum_site_settings_socials_platform" ADD VALUE IF NOT EXISTS 'whatsapp';`)
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  // Значения enum-типа PostgreSQL удалить нельзя — откат не трогает enum.
}
