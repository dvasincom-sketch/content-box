import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Фундамент «глубокого» конструктора главной:
 *  1) колонка `config` (jsonb) в строках секций — пер-секционный конфиг
 *     (заголовок, вариант, тема, источник) одним гибким блобом (без частых миграций);
 *  2) значения enum типов секций заранее — `authorSpotlight` (закрывает латентный
 *     пробел уже добавленной секции) + будущие типы, чтобы новые секции добавлялись
 *     кодом без миграций.
 *
 * `config` читается/валидируется в normalizeHomeSections; на рендере — resolveSectionData.
 */
const NEW_TYPES = [
  'authorSpotlight',
  'continue',
  'carousel',
  'posterGrid',
  'top',
  'shelf',
  'activity',
  'topFans',
  'goals',
  'poll',
  'schedule',
  'reviews',
  'chatCta',
  'ctaSub',
  'faq',
]

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "site_settings_home_sections" ADD COLUMN IF NOT EXISTS "config" jsonb;`)
  for (const t of NEW_TYPES) {
    await db.execute(
      sql.raw(`ALTER TYPE "public"."enum_site_settings_home_sections_type" ADD VALUE IF NOT EXISTS '${t}';`),
    )
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Значения enum в PostgreSQL убрать нельзя (оставляем). Откатываем только колонку.
  await db.execute(sql`ALTER TABLE "site_settings_home_sections" DROP COLUMN IF EXISTS "config";`)
}
