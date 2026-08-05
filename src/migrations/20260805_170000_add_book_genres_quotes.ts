import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Поля произведения из формы Litnet: два жанра, три цитаты (видны читателю),
 * буктрейлер (ссылка на видео). Всё — простые varchar-колонки, без enum/FK.
 * Жанр хранится строкой-меткой (список фиксированный в UI, но схема гибкая).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "books" ADD COLUMN "genre1" varchar;
  ALTER TABLE "books" ADD COLUMN "genre2" varchar;
  ALTER TABLE "books" ADD COLUMN "quote1" varchar;
  ALTER TABLE "books" ADD COLUMN "quote2" varchar;
  ALTER TABLE "books" ADD COLUMN "quote3" varchar;
  ALTER TABLE "books" ADD COLUMN "booktrailer" varchar;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "books" DROP COLUMN IF EXISTS "genre1";
  ALTER TABLE "books" DROP COLUMN IF EXISTS "genre2";
  ALTER TABLE "books" DROP COLUMN IF EXISTS "quote1";
  ALTER TABLE "books" DROP COLUMN IF EXISTS "quote2";
  ALTER TABLE "books" DROP COLUMN IF EXISTS "quote3";
  ALTER TABLE "books" DROP COLUMN IF EXISTS "booktrailer";`)
}
