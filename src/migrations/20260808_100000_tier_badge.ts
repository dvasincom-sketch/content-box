import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Поле «Бейдж (плашка)» на уровнях подписки — настраиваемая метка тарифа
 * («Популярный», «Выгодно»). Пусто — без плашки. Обычный nullable text.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "subscription_tiers" ADD COLUMN IF NOT EXISTS "badge" varchar;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "subscription_tiers" DROP COLUMN IF EXISTS "badge";`)
}
