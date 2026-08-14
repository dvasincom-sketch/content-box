import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * gallery-images.sourcePublication — связь изображения с публикацией, через
 * композер которой оно загружено. Даёт автоматическую организацию библиотеки
 * «по публикациям» (P0 медиа-менеджера). ON DELETE set null: удаление
 * публикации не удаляет картинку.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "gallery_images" ADD COLUMN "source_publication_id" integer;
  ALTER TABLE "gallery_images" ADD CONSTRAINT "gallery_images_source_publication_id_publications_id_fk" FOREIGN KEY ("source_publication_id") REFERENCES "public"."publications"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "gallery_images_source_publication_idx" ON "gallery_images" USING btree ("source_publication_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  DROP INDEX "gallery_images_source_publication_idx";
  ALTER TABLE "gallery_images" DROP CONSTRAINT "gallery_images_source_publication_id_publications_id_fk";
  ALTER TABLE "gallery_images" DROP COLUMN "source_publication_id";`)
}
