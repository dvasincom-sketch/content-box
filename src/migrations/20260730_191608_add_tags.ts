import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Свободные теги для публикаций и видео (array-поле {label, slug}).
 *
 * Только таблицы тегов — вручную, а не автогенератором: в проекте нет свежих
 * .json-снимков схемы, поэтому `payload migrate:create` пытается пересоздать
 * половину базы. Statements по тегам взяты из его вывода как есть.
 *
 * slug индексируется — по нему идёт запрос страницы тега /tag/<slug> и подбор
 * «похожих по тегам». FK на родителя — ON DELETE cascade: удалили публикацию/
 * видео → его строки тегов уходят вместе с ним.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "publications_tags" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"slug" varchar
  );

   CREATE TABLE "videos_tags" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"slug" varchar
  );

   ALTER TABLE "publications_tags" ADD CONSTRAINT "publications_tags_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."publications"("id") ON DELETE cascade ON UPDATE no action;
   ALTER TABLE "videos_tags" ADD CONSTRAINT "videos_tags_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;
   CREATE INDEX "publications_tags_order_idx" ON "publications_tags" USING btree ("_order");
   CREATE INDEX "publications_tags_parent_id_idx" ON "publications_tags" USING btree ("_parent_id");
   CREATE INDEX "publications_tags_slug_idx" ON "publications_tags" USING btree ("slug");
   CREATE INDEX "videos_tags_order_idx" ON "videos_tags" USING btree ("_order");
   CREATE INDEX "videos_tags_parent_id_idx" ON "videos_tags" USING btree ("_parent_id");
   CREATE INDEX "videos_tags_slug_idx" ON "videos_tags" USING btree ("slug");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "publications_tags" CASCADE;
   DROP TABLE "videos_tags" CASCADE;`)
}
