import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/** Шаблон «раздел-события»: флаг на категории + дата события на публикации. */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "event_template" boolean DEFAULT false;`)
  await db.execute(sql`ALTER TABLE "publications" ADD COLUMN IF NOT EXISTS "event_date" timestamp(3) with time zone;`)
}
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "categories" DROP COLUMN IF EXISTS "event_template";`)
  await db.execute(sql`ALTER TABLE "publications" DROP COLUMN IF EXISTS "event_date";`)
}
