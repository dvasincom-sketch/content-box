import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Профиль участника (Фаза 1 «Сообщество»).
 * subscribers: avatar (→media), bio, handle (уникален в рамках тенанта),
 * profile_private (публичный по умолчанию), points/level (заглушки Фазы 2).
 * Типы по снапшоту: upload→<col>_id integer + FK; textarea/text→varchar;
 * checkbox→boolean; number→numeric.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "subscribers" ADD COLUMN "avatar_id" integer;
  ALTER TABLE "subscribers" ADD COLUMN "bio" varchar;
  ALTER TABLE "subscribers" ADD COLUMN "handle" varchar;
  ALTER TABLE "subscribers" ADD COLUMN "profile_private" boolean DEFAULT false;
  ALTER TABLE "subscribers" ADD COLUMN "points" numeric DEFAULT 0;
  ALTER TABLE "subscribers" ADD COLUMN "level" numeric DEFAULT 0;
  ALTER TABLE "subscribers" ADD CONSTRAINT "subscribers_avatar_id_media_id_fk" FOREIGN KEY ("avatar_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "subscribers_avatar_idx" ON "subscribers" USING btree ("avatar_id");
  CREATE UNIQUE INDEX "subscribers_tenant_handle_idx" ON "subscribers" USING btree ("tenant_id","handle") WHERE "handle" IS NOT NULL;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX IF EXISTS "subscribers_tenant_handle_idx";
  DROP INDEX IF EXISTS "subscribers_avatar_idx";
  ALTER TABLE "subscribers" DROP CONSTRAINT IF EXISTS "subscribers_avatar_id_media_id_fk";
  ALTER TABLE "subscribers" DROP COLUMN "avatar_id";
  ALTER TABLE "subscribers" DROP COLUMN "bio";
  ALTER TABLE "subscribers" DROP COLUMN "handle";
  ALTER TABLE "subscribers" DROP COLUMN "profile_private";
  ALTER TABLE "subscribers" DROP COLUMN "points";
  ALTER TABLE "subscribers" DROP COLUMN "level";`)
}
