import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Внешние видео-вставки: VK Видео, VK Клипы, Дзен.
 *
 * videos.provider += 'embed'  — видео лежит на чужой площадке.
 * videos.embed_provider       — какая именно площадка (определяется разбором ссылки).
 * videos.embed_src            — нормализованный src для iframe. Пишет только сервер
 *                               после проверки хоста по белому списку; редактировать
 *                               руками нельзя, иначе проверка обходится.
 * videos.embed_aspect         — пропорции: 16:9 обычное видео, 9:16 вертикальный клип.
 *
 * Сырой HTML кода вставки НЕ хранится: разметка от автора в странице — это XSS.
 * Разбор в src/lib/videoEmbed.ts, iframe собирается приложением.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_videos_provider" ADD VALUE IF NOT EXISTS 'embed';`)

  // ALTER TYPE ... ADD VALUE не виден внутри той же транзакции, в которой
  // выполнен, поэтому новые типы и колонки — отдельным запросом.
  await db.execute(sql`
   CREATE TYPE "public"."enum_videos_embed_provider" AS ENUM('vk', 'vk-clip', 'dzen');
   CREATE TYPE "public"."enum_videos_embed_aspect" AS ENUM('16:9', '9:16');
   ALTER TABLE "videos" ADD COLUMN "embed_provider" "enum_videos_embed_provider";
   ALTER TABLE "videos" ADD COLUMN "embed_src" varchar;
   ALTER TABLE "videos" ADD COLUMN "embed_aspect" "enum_videos_embed_aspect" DEFAULT '16:9';`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Значение из enum-типа PostgreSQL убрать нельзя, поэтому 'embed' в
  // enum_videos_provider остаётся. Сами видео с ним переводим в 'kinescope',
  // иначе после отката останутся строки со значением, которого нет в коде.
  await db.execute(sql`
   UPDATE "videos" SET "provider" = 'kinescope' WHERE "provider" = 'embed';
   ALTER TABLE "videos" DROP COLUMN "embed_aspect";
   ALTER TABLE "videos" DROP COLUMN "embed_src";
   ALTER TABLE "videos" DROP COLUMN "embed_provider";
   DROP TYPE "public"."enum_videos_embed_aspect";
   DROP TYPE "public"."enum_videos_embed_provider";`)
}
