import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Комментарии по главам книг: цель комментария — публикация ИЛИ глава.
 * Снимаем NOT NULL с publication_id (у комментария к главе он пуст) и добавляем
 * chapter_id. Enum targetType у comments нет — различаем по заполненной связи.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "comments" ALTER COLUMN "publication_id" DROP NOT NULL;
  ALTER TABLE "comments" ADD COLUMN "chapter_id" integer;
  ALTER TABLE "comments" ADD CONSTRAINT "comments_chapter_id_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "public"."chapters"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "comments_chapter_idx" ON "comments" USING btree ("chapter_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // publication_id оставляем nullable (обратно NOT NULL не ставим — упало бы,
  // если есть комментарии к главам).
  await db.execute(sql`
   ALTER TABLE "comments" DROP CONSTRAINT IF EXISTS "comments_chapter_id_chapters_id_fk";
  DROP INDEX IF EXISTS "comments_chapter_idx";
  ALTER TABLE "comments" DROP COLUMN IF EXISTS "chapter_id";`)
}
