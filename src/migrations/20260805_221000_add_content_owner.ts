import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Владелец контента: колонка owner_id (→ users) на контентных коллекциях, чтобы
 * ограниченный участник видел/правил только свои записи. FK ON DELETE set null —
 * удаление студийного аккаунта не рушит контент, просто обнуляет владельца.
 *
 * Существующие записи получают owner = NULL (созданы до модели владения) —
 * править их сможет только полный сотрудник, участнику они не видны.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "publications" ADD COLUMN "owner_id" integer;
  ALTER TABLE "videos" ADD COLUMN "owner_id" integer;
  ALTER TABLE "books" ADD COLUMN "owner_id" integer;
  ALTER TABLE "chapters" ADD COLUMN "owner_id" integer;
  ALTER TABLE "gallery_images" ADD COLUMN "owner_id" integer;
  ALTER TABLE "downloads" ADD COLUMN "owner_id" integer;
  ALTER TABLE "publications" ADD CONSTRAINT "publications_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "videos" ADD CONSTRAINT "videos_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "books" ADD CONSTRAINT "books_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "chapters" ADD CONSTRAINT "chapters_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "gallery_images" ADD CONSTRAINT "gallery_images_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "downloads" ADD CONSTRAINT "downloads_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "publications_owner_idx" ON "publications" USING btree ("owner_id");
  CREATE INDEX "videos_owner_idx" ON "videos" USING btree ("owner_id");
  CREATE INDEX "books_owner_idx" ON "books" USING btree ("owner_id");
  CREATE INDEX "chapters_owner_idx" ON "chapters" USING btree ("owner_id");
  CREATE INDEX "gallery_images_owner_idx" ON "gallery_images" USING btree ("owner_id");
  CREATE INDEX "downloads_owner_idx" ON "downloads" USING btree ("owner_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "publications" DROP CONSTRAINT IF EXISTS "publications_owner_id_users_id_fk";
  ALTER TABLE "videos" DROP CONSTRAINT IF EXISTS "videos_owner_id_users_id_fk";
  ALTER TABLE "books" DROP CONSTRAINT IF EXISTS "books_owner_id_users_id_fk";
  ALTER TABLE "chapters" DROP CONSTRAINT IF EXISTS "chapters_owner_id_users_id_fk";
  ALTER TABLE "gallery_images" DROP CONSTRAINT IF EXISTS "gallery_images_owner_id_users_id_fk";
  ALTER TABLE "downloads" DROP CONSTRAINT IF EXISTS "downloads_owner_id_users_id_fk";
  DROP INDEX IF EXISTS "publications_owner_idx";
  DROP INDEX IF EXISTS "videos_owner_idx";
  DROP INDEX IF EXISTS "books_owner_idx";
  DROP INDEX IF EXISTS "chapters_owner_idx";
  DROP INDEX IF EXISTS "gallery_images_owner_idx";
  DROP INDEX IF EXISTS "downloads_owner_idx";
  ALTER TABLE "publications" DROP COLUMN IF EXISTS "owner_id";
  ALTER TABLE "videos" DROP COLUMN IF EXISTS "owner_id";
  ALTER TABLE "books" DROP COLUMN IF EXISTS "owner_id";
  ALTER TABLE "chapters" DROP COLUMN IF EXISTS "owner_id";
  ALTER TABLE "gallery_images" DROP COLUMN IF EXISTS "owner_id";
  ALTER TABLE "downloads" DROP COLUMN IF EXISTS "owner_id";`)
}
