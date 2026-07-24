import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Регистрация-онбординг автора.
 *
 * users:   name (отображаемое имя автора).
 * tenants: subdomain (уник.), category (enum-ниша), description,
 *          onboarding_step (возобновление мастера), onboarding_complete (флаг).
 *
 * Типы колонок выверены по существующим миграциям:
 *   text/textarea → varchar, number → numeric, checkbox → boolean, select → enum.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_tenants_category" AS ENUM('blogger', 'musician', 'podcaster', 'streamer', 'artist', 'education', 'other');
  ALTER TABLE "users" ADD COLUMN "name" varchar;
  ALTER TABLE "tenants" ADD COLUMN "subdomain" varchar;
  ALTER TABLE "tenants" ADD COLUMN "category" "enum_tenants_category";
  ALTER TABLE "tenants" ADD COLUMN "description" varchar;
  ALTER TABLE "tenants" ADD COLUMN "onboarding_step" numeric DEFAULT 0;
  ALTER TABLE "tenants" ADD COLUMN "onboarding_complete" boolean DEFAULT false;
  CREATE UNIQUE INDEX "tenants_subdomain_idx" ON "tenants" USING btree ("subdomain");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "tenants_subdomain_idx";
  ALTER TABLE "users" DROP COLUMN "name";
  ALTER TABLE "tenants" DROP COLUMN "subdomain";
  ALTER TABLE "tenants" DROP COLUMN "category";
  ALTER TABLE "tenants" DROP COLUMN "description";
  ALTER TABLE "tenants" DROP COLUMN "onboarding_step";
  ALTER TABLE "tenants" DROP COLUMN "onboarding_complete";
  DROP TYPE "public"."enum_tenants_category";`)
}
