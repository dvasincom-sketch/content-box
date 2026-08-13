import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Шаблон публикации: 'article' (обычная, по умолчанию) или 'profile' (страница-
 * досье). profile (jsonb) — структурированный контент для шаблона «Профиль».
 * template — varchar (не enum), чтобы легко добавлять новые шаблоны без миграций.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "publications" ADD COLUMN IF NOT EXISTS "template" varchar DEFAULT 'article';`)
  await db.execute(sql`ALTER TABLE "publications" ADD COLUMN IF NOT EXISTS "profile" jsonb;`)
}
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "publications" DROP COLUMN IF EXISTS "profile";`)
  await db.execute(sql`ALTER TABLE "publications" DROP COLUMN IF EXISTS "template";`)
}
