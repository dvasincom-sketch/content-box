import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Читательская библиотека + прогресс чтения книг на существующих коллекциях:
 *  - bookmarks: цель «книга» (полка «в библиотеку» / «хочу прочитать»);
 *  - views: цель «книга» + last-read глава (chapter) → прогресс «Читаю/Прочитано».
 *
 * ADD VALUE идемпотентно; новые значения в этой же миграции не используются
 * (только ALTER TABLE), поэтому PG16 добавляет их без проблем.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_bookmarks_target_type" ADD VALUE IF NOT EXISTS 'book';
  ALTER TYPE "public"."enum_views_target_type" ADD VALUE IF NOT EXISTS 'book';
  ALTER TABLE "bookmarks" ADD COLUMN "book_id" integer;
  ALTER TABLE "views" ADD COLUMN "book_id" integer;
  ALTER TABLE "views" ADD COLUMN "chapter_id" integer;
  ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "views" ADD CONSTRAINT "views_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "views" ADD CONSTRAINT "views_chapter_id_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "public"."chapters"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "bookmarks_book_idx" ON "bookmarks" USING btree ("book_id");
  CREATE INDEX "views_book_idx" ON "views" USING btree ("book_id");
  CREATE INDEX "views_chapter_idx" ON "views" USING btree ("chapter_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "bookmarks" DROP CONSTRAINT IF EXISTS "bookmarks_book_id_books_id_fk";
  ALTER TABLE "views" DROP CONSTRAINT IF EXISTS "views_book_id_books_id_fk";
  ALTER TABLE "views" DROP CONSTRAINT IF EXISTS "views_chapter_id_chapters_id_fk";
  DROP INDEX IF EXISTS "bookmarks_book_idx";
  DROP INDEX IF EXISTS "views_book_idx";
  DROP INDEX IF EXISTS "views_chapter_idx";
  ALTER TABLE "bookmarks" DROP COLUMN IF EXISTS "book_id";
  ALTER TABLE "views" DROP COLUMN IF EXISTS "book_id";
  ALTER TABLE "views" DROP COLUMN IF EXISTS "chapter_id";`)
}
