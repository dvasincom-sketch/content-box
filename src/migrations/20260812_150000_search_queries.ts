import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Лог поисковых запросов по сайту (per-tenant). Append-only; агрегируется в
 * студийной аналитике: «популярные» (топ по частоте за период) и «недавние».
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "search_queries" (
      "id" bigserial PRIMARY KEY,
      "tenant_id" integer NOT NULL,
      "q" text NOT NULL,
      "results" integer DEFAULT 0,
      "created_at" timestamptz DEFAULT now() NOT NULL
    );
  `)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "search_queries_tenant_created_idx" ON "search_queries" ("tenant_id","created_at");`)
}
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`DROP TABLE IF EXISTS "search_queries";`)
}
