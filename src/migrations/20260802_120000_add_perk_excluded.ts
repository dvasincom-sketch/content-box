import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Новый тип плюшки подписки: 'excluded' — «не входит» (иконка-прочерк на витрине).
 *
 * enum_subscription_tiers_perks_type += 'excluded'.
 * Больше ничего: колонка perks.type уже существует, добавляется только значение.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_subscription_tiers_perks_type" ADD VALUE IF NOT EXISTS 'excluded';`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Значение из enum-типа PostgreSQL убрать нельзя, поэтому 'excluded' остаётся.
  // Существующие плюшки с этим типом переводим в 'included', иначе после отката
  // остались бы строки со значением, которого нет в коде.
  await db.execute(sql`
   UPDATE "subscription_tiers_perks" SET "type" = 'included' WHERE "type" = 'excluded';`)
}
