import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Поле «Umami website ID» на тенанте (веб-аналитика self-hosted Umami).
 * Обычный nullable text — один website Umami на тенант. Пусто → трекер на
 * фронте не подключается. По id не фильтруем, индекс не нужен.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "umami_website_id" varchar;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "tenants" DROP COLUMN IF EXISTS "umami_website_id";`)
}
