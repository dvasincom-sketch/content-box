import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Приглашения участников студии: поля на users для одноразовой ссылки-инвайта.
 * invite_token_hash — sha256 токена (сырой токен только в ссылке, в БД не хранится);
 * invite_expires_at — срок; invite_accepted_at — когда принято (null = ожидает);
 * invited_by_id — кто пригласил.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "users" ADD COLUMN "invited_by_id" integer;
  ALTER TABLE "users" ADD COLUMN "invite_token_hash" varchar;
  ALTER TABLE "users" ADD COLUMN "invite_expires_at" timestamp(3) with time zone;
  ALTER TABLE "users" ADD COLUMN "invite_accepted_at" timestamp(3) with time zone;
  ALTER TABLE "users" ADD CONSTRAINT "users_invited_by_id_users_id_fk" FOREIGN KEY ("invited_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "users_invited_by_idx" ON "users" USING btree ("invited_by_id");
  CREATE INDEX "users_invite_token_hash_idx" ON "users" USING btree ("invite_token_hash");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_invited_by_id_users_id_fk";
  DROP INDEX IF EXISTS "users_invited_by_idx";
  DROP INDEX IF EXISTS "users_invite_token_hash_idx";
  ALTER TABLE "users" DROP COLUMN IF EXISTS "invited_by_id";
  ALTER TABLE "users" DROP COLUMN IF EXISTS "invite_token_hash";
  ALTER TABLE "users" DROP COLUMN IF EXISTS "invite_expires_at";
  ALTER TABLE "users" DROP COLUMN IF EXISTS "invite_accepted_at";`)
}
