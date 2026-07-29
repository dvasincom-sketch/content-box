import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Видео-плейлисты (сезоны/эпизоды).
 *
 * videos.season   — номер сезона (пусто = вне сезона / спецвыпуски).
 * videos.episode  — порядок эпизода внутри сезона/плейлиста (сортировка).
 * categories.video_series — категория рендерится как видео-плейлист
 *   (плеер + список серий по сезонам, YouTube-подобно). Параллель posterLayout.
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "videos" ADD COLUMN "season" numeric;
   ALTER TABLE "videos" ADD COLUMN "episode" numeric;
   ALTER TABLE "categories" ADD COLUMN "video_series" boolean DEFAULT false;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "categories" DROP COLUMN "video_series";
   ALTER TABLE "videos" DROP COLUMN "episode";
   ALTER TABLE "videos" DROP COLUMN "season";`)
}
