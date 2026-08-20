import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * videos.external_ref — идентификатор источника при импорте (напр.
 * `vk:-217576166_456…`) для дедупликации повторного импорта плейлиста VK.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "videos" ADD COLUMN "external_ref" varchar;
  CREATE INDEX "videos_external_ref_idx" ON "videos" USING btree ("external_ref");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX IF EXISTS "videos_external_ref_idx";
  ALTER TABLE "videos" DROP COLUMN IF EXISTS "external_ref";`)
}
