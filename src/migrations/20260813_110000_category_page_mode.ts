import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Тип раздела «Страница»: категория рендерится как одна привязанная публикация
 * (например, профиль), без списка вложенных публикаций.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "page_mode" boolean DEFAULT false;`)
}
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "categories" DROP COLUMN IF EXISTS "page_mode";`)
}
