import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Импорт видео по ссылке (Яндекс.Диск): воркер скачивает оригинал напрямую из
 * внешнего источника, а не из нашего S3. Поэтому у задачи появляется source_url,
 * а original_key становится необязательным (для загрузки файлом он есть, для
 * импорта по ссылке — пуст).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "video_jobs" ADD COLUMN IF NOT EXISTS "source_url" varchar;
    ALTER TABLE "video_jobs" ALTER COLUMN "original_key" DROP NOT NULL;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "video_jobs" DROP COLUMN IF EXISTS "source_url";`)
}
