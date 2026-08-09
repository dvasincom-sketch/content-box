import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Разовый бэкфилл #6: у прикреплённых видео с пустым/плейсхолдерным названием
 * («Видео · …») подставляем заголовок публикации, к которой они прикреплены.
 * Хук afterChange делает это для будущих сохранений; здесь — для существующих.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  UPDATE "videos" v
  SET "title" = p."title"
  FROM "publications_rels" r
  JOIN "publications" p ON p."id" = r."parent_id"
  WHERE r."path" = 'relatedVideos'
    AND r."videos_id" = v."id"
    AND p."title" IS NOT NULL AND p."title" <> ''
    AND (v."title" IS NULL OR v."title" = '' OR v."title" LIKE 'Видео · %');`)
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  // Бэкфилл необратим — плейсхолдеры не восстанавливаем.
}
