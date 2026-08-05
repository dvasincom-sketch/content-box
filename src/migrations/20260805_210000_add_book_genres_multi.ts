import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Жанры произведения — один мультивыбор вместо Жанр1/Жанр2. Храним список меток
 * через запятую в одной колонке `genres` (фикс-список, без запятых в метках).
 * Старые genre1/genre2 оставляем осиротевшими (поля убраны из конфига).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "books" ADD COLUMN "genres" varchar;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "books" DROP COLUMN IF EXISTS "genres";`)
}
