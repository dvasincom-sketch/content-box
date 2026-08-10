import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/** Авто-главы своего видео: json [{ start, title }]. */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "videos" ADD COLUMN IF NOT EXISTS "chapters" jsonb;`)
}
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "videos" DROP COLUMN IF EXISTS "chapters";`)
}
