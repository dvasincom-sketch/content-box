import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "gallery_images" ADD COLUMN "sizes_thumbnail_url" varchar;
  ALTER TABLE "gallery_images" ADD COLUMN "sizes_thumbnail_width" numeric;
  ALTER TABLE "gallery_images" ADD COLUMN "sizes_thumbnail_height" numeric;
  ALTER TABLE "gallery_images" ADD COLUMN "sizes_thumbnail_mime_type" varchar;
  ALTER TABLE "gallery_images" ADD COLUMN "sizes_thumbnail_filesize" numeric;
  ALTER TABLE "gallery_images" ADD COLUMN "sizes_thumbnail_filename" varchar;
  ALTER TABLE "gallery_images" ADD COLUMN "sizes_large_url" varchar;
  ALTER TABLE "gallery_images" ADD COLUMN "sizes_large_width" numeric;
  ALTER TABLE "gallery_images" ADD COLUMN "sizes_large_height" numeric;
  ALTER TABLE "gallery_images" ADD COLUMN "sizes_large_mime_type" varchar;
  ALTER TABLE "gallery_images" ADD COLUMN "sizes_large_filesize" numeric;
  ALTER TABLE "gallery_images" ADD COLUMN "sizes_large_filename" varchar;
  CREATE INDEX "gallery_images_sizes_thumbnail_sizes_thumbnail_filename_idx" ON "gallery_images" USING btree ("sizes_thumbnail_filename");
  CREATE INDEX "gallery_images_sizes_large_sizes_large_filename_idx" ON "gallery_images" USING btree ("sizes_large_filename");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "gallery_images_sizes_thumbnail_sizes_thumbnail_filename_idx";
  DROP INDEX "gallery_images_sizes_large_sizes_large_filename_idx";
  ALTER TABLE "gallery_images" DROP COLUMN "sizes_thumbnail_url";
  ALTER TABLE "gallery_images" DROP COLUMN "sizes_thumbnail_width";
  ALTER TABLE "gallery_images" DROP COLUMN "sizes_thumbnail_height";
  ALTER TABLE "gallery_images" DROP COLUMN "sizes_thumbnail_mime_type";
  ALTER TABLE "gallery_images" DROP COLUMN "sizes_thumbnail_filesize";
  ALTER TABLE "gallery_images" DROP COLUMN "sizes_thumbnail_filename";
  ALTER TABLE "gallery_images" DROP COLUMN "sizes_large_url";
  ALTER TABLE "gallery_images" DROP COLUMN "sizes_large_width";
  ALTER TABLE "gallery_images" DROP COLUMN "sizes_large_height";
  ALTER TABLE "gallery_images" DROP COLUMN "sizes_large_mime_type";
  ALTER TABLE "gallery_images" DROP COLUMN "sizes_large_filesize";
  ALTER TABLE "gallery_images" DROP COLUMN "sizes_large_filename";`)
}
