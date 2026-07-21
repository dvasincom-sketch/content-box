import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "publications" ADD COLUMN "is_news" boolean DEFAULT false;
  CREATE INDEX "publications_is_news_idx" ON "publications" USING btree ("is_news");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "publications_is_news_idx";
  ALTER TABLE "publications" DROP COLUMN "is_news";`)
}
