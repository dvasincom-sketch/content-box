import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * publications.watch_category_id — связка «Мир BTS» → «Смотреть».
 *
 * Статья-энциклопедия ссылается на категорию с видео по теме (связь 1:1).
 * ON DELETE set null — удаление категории «Смотреть» не роняет статью, просто
 * снимает связку.
 *
 * Два индекса:
 *   publications_watch_category_idx    — обычный btree, как у прочих
 *                                        relationship-полей (ускоряет обратный
 *                                        запрос со страницы категории).
 *   publications_watch_category_unique — ЧАСТИЧНЫЙ уникальный (WHERE NOT NULL):
 *                                        одну категорию нельзя привязать к двум
 *                                        статьям. Хук в Publications.ts даёт
 *                                        дружелюбную ошибку раньше, это —
 *                                        гарантия на уровне БД против гонки.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "publications" ADD COLUMN "watch_category_id" integer;
   ALTER TABLE "publications" ADD CONSTRAINT "publications_watch_category_id_categories_id_fk" FOREIGN KEY ("watch_category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
   CREATE INDEX "publications_watch_category_idx" ON "publications" USING btree ("watch_category_id");
   CREATE UNIQUE INDEX "publications_watch_category_unique" ON "publications" USING btree ("watch_category_id") WHERE "watch_category_id" IS NOT NULL;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "publications_watch_category_unique";
   DROP INDEX "publications_watch_category_idx";
   ALTER TABLE "publications" DROP CONSTRAINT "publications_watch_category_id_categories_id_fk";
   ALTER TABLE "publications" DROP COLUMN "watch_category_id";`)
}
