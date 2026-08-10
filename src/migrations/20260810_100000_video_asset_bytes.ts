import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/** Размер HLS-артефактов своего видео в S3 — для учёта места на дашборде. */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "videos" ADD COLUMN IF NOT EXISTS "asset_bytes" bigint;`)
}
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "videos" DROP COLUMN IF EXISTS "asset_bytes";`)
}
