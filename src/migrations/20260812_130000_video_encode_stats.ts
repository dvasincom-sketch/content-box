import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Телеметрия кодирования на видео: исходный размер файла, время кодирования и
 * профиль, которым кодировали. Копим данные, чтобы принимать решения о развитии
 * (durationSec и assetBytes уже есть). Прозрачно показываем в панели профиля.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "videos" ADD COLUMN IF NOT EXISTS "original_bytes" numeric;
    ALTER TABLE "videos" ADD COLUMN IF NOT EXISTS "encode_ms" numeric;
    ALTER TABLE "videos" ADD COLUMN IF NOT EXISTS "video_profile" varchar;`)
}
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "videos" DROP COLUMN IF EXISTS "video_profile";
    ALTER TABLE "videos" DROP COLUMN IF EXISTS "encode_ms";
    ALTER TABLE "videos" DROP COLUMN IF EXISTS "original_bytes";`)
}
