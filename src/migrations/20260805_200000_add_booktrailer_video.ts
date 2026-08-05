import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Буктрейлер как связь с видео из раздела «Видео» (кросс-блок с медиа), вместо
 * сырой ссылки. Старую varchar-колонку booktrailer оставляем (осиротевшей —
 * поле убрано из конфига), добавляем FK на videos.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "books" ADD COLUMN "booktrailer_video_id" integer;
  ALTER TABLE "books" ADD CONSTRAINT "books_booktrailer_video_id_videos_id_fk" FOREIGN KEY ("booktrailer_video_id") REFERENCES "public"."videos"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "books_booktrailer_video_idx" ON "books" USING btree ("booktrailer_video_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "books" DROP CONSTRAINT IF EXISTS "books_booktrailer_video_id_videos_id_fk";
  DROP INDEX IF EXISTS "books_booktrailer_video_idx";
  ALTER TABLE "books" DROP COLUMN IF EXISTS "booktrailer_video_id";`)
}
