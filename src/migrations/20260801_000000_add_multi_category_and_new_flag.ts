import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * #4 — дополнительные категории публикации (мультивыбор) и #5 — флаг «Новинка».
 *
 * #4: `extraCategories` — hasMany relationship, поэтому Payload хранит его в уже
 * существующей таблице связей `publications_rels` (создана миграцией
 * related_videos) в колонке `categories_id` при `path = 'extraCategories'`.
 * Основная категория `category` остаётся отдельной колонкой `category_id` —
 * миграция аддитивная, ничего не переносит и не удаляет.
 *
 * #5: `is_new` — флаг «Новинка»; `new_until` — момент, до которого публикация
 * висит в разделе «Новинки» (хук в Publications.ts ставит сейчас + 14 дней).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "publications_rels" ADD COLUMN IF NOT EXISTS "categories_id" integer;
   ALTER TABLE "publications_rels" ADD CONSTRAINT "publications_rels_categories_fk" FOREIGN KEY ("categories_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
   CREATE INDEX IF NOT EXISTS "publications_rels_categories_id_idx" ON "publications_rels" USING btree ("categories_id");

   ALTER TABLE "publications" ADD COLUMN IF NOT EXISTS "is_new" boolean DEFAULT false;
   ALTER TABLE "publications" ADD COLUMN IF NOT EXISTS "new_until" timestamp(3) with time zone;
   CREATE INDEX IF NOT EXISTS "publications_is_new_idx" ON "publications" USING btree ("is_new");
   CREATE INDEX IF NOT EXISTS "publications_new_until_idx" ON "publications" USING btree ("new_until");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX IF EXISTS "publications_new_until_idx";
   DROP INDEX IF EXISTS "publications_is_new_idx";
   ALTER TABLE "publications" DROP COLUMN IF EXISTS "new_until";
   ALTER TABLE "publications" DROP COLUMN IF EXISTS "is_new";

   DROP INDEX IF EXISTS "publications_rels_categories_id_idx";
   ALTER TABLE "publications_rels" DROP CONSTRAINT IF EXISTS "publications_rels_categories_fk";
   ALTER TABLE "publications_rels" DROP COLUMN IF EXISTS "categories_id";`)
}
