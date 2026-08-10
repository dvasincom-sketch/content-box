import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/** Кэш краткого содержания видео от Аси (json). */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "videos" ADD COLUMN IF NOT EXISTS "summary" jsonb;`)
}
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "videos" DROP COLUMN IF EXISTS "summary";`)
}
