import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Аудио-контент: videos.provider += 'audio', videos.audio_src (URL MP3 в S3).
 * Аудио и видео живут в одной коллекции (различие — provider), чтобы
 * переиспользовать серии-плейлисты, доступ по подписке и теги.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_videos_provider" ADD VALUE IF NOT EXISTS 'audio';`)
  // ALTER TYPE ADD VALUE не виден в той же транзакции — колонку отдельно.
  await db.execute(sql`
   ALTER TABLE "videos" ADD COLUMN IF NOT EXISTS "audio_src" varchar;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Значение enum убрать нельзя; аудио-записи переводим в kinescope, колонку сносим.
  await db.execute(sql`
   UPDATE "videos" SET "provider" = 'kinescope' WHERE "provider" = 'audio';
   ALTER TABLE "videos" DROP COLUMN IF EXISTS "audio_src";`)
}
