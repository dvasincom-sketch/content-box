import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Тонкие права доступа в студии (Фаза 1). Добавляет на users:
 *  - studio_role (varchar) — метка пресета роли (owner|admin|editor|author|moderator|viewer|custom);
 *  - capabilities (jsonb)  — фактическая матрица прав; пусто = пресет по роли.
 * Бэкофилл studio_role по текущему tenant_role, чтобы поведение не изменилось:
 *  editor/admin → owner (полный доступ), contributor → author (только своё), viewer → viewer.
 * Вручную (нет .json-снимков схемы).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "studio_role" varchar;
  ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "capabilities" jsonb;
  UPDATE "users" SET "studio_role" = 'owner'  WHERE "tenant_role" IN ('editor','admin') AND "studio_role" IS NULL;
  UPDATE "users" SET "studio_role" = 'author' WHERE "tenant_role" = 'contributor'          AND "studio_role" IS NULL;
  UPDATE "users" SET "studio_role" = 'viewer' WHERE "tenant_role" = 'viewer'               AND "studio_role" IS NULL;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "users" DROP COLUMN IF EXISTS "capabilities";
  ALTER TABLE "users" DROP COLUMN IF EXISTS "studio_role";`)
}
