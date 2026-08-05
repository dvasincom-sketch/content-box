import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * «Произведение» = одна сущность с типом (роман/рассказ/миниатюра/цикл), как на
 * Litnet. Отдельных коллекций под типы не заводим — тип выбирается при создании.
 * Цикл — само-связь: произведение типа 'cycle' это контейнер, остальные
 * ссылаются на него (cycle_id) + номер в цикле (cycle_order).
 *
 * Плюс возрастной рейтинг (12/16/18) вместо грубого флажка и разрешения
 * (комментарии/скачивание). Колонку is_adult оставляем как есть (не трогаем
 * данные), просто перестаём использовать в конфиге.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_books_type" AS ENUM('novel', 'story', 'mini', 'cycle');
  CREATE TYPE "public"."enum_books_age_rating" AS ENUM('12', '16', '18');
  ALTER TABLE "books" ADD COLUMN "type" "enum_books_type" DEFAULT 'novel';
  ALTER TABLE "books" ADD COLUMN "age_rating" "enum_books_age_rating" DEFAULT '16';
  ALTER TABLE "books" ADD COLUMN "cycle_id" integer;
  ALTER TABLE "books" ADD COLUMN "cycle_order" numeric;
  ALTER TABLE "books" ADD COLUMN "allow_comments" boolean DEFAULT true;
  ALTER TABLE "books" ADD COLUMN "allow_download" boolean DEFAULT false;
  ALTER TABLE "books" ADD CONSTRAINT "books_cycle_id_books_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."books"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "books_cycle_idx" ON "books" USING btree ("cycle_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "books" DROP CONSTRAINT IF EXISTS "books_cycle_id_books_id_fk";
  DROP INDEX IF EXISTS "books_cycle_idx";
  ALTER TABLE "books" DROP COLUMN IF EXISTS "type";
  ALTER TABLE "books" DROP COLUMN IF EXISTS "age_rating";
  ALTER TABLE "books" DROP COLUMN IF EXISTS "cycle_id";
  ALTER TABLE "books" DROP COLUMN IF EXISTS "cycle_order";
  ALTER TABLE "books" DROP COLUMN IF EXISTS "allow_comments";
  ALTER TABLE "books" DROP COLUMN IF EXISTS "allow_download";
  DROP TYPE "public"."enum_books_type";
  DROP TYPE "public"."enum_books_age_rating";`)
}
