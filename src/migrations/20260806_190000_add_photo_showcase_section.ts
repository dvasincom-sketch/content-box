import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Новый тип секции главной 'photoShowcase' («Фото на весь экран» из папки
 * галереи). enum_site_settings_home_sections_type += 'photoShowcase'.
 * Значение enum в PostgreSQL убрать нельзя — down лишь снимает его с записей.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_site_settings_home_sections_type" ADD VALUE IF NOT EXISTS 'photoShowcase';`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   UPDATE "site_settings_home_sections" SET "type" = 'latest' WHERE "type" = 'photoShowcase';`)
}
