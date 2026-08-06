import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Новое значение действия журнала активности студии — 'invite' (приглашение
 * участника). enum_studio_activity_action += 'invite'. Значение enum в PostgreSQL
 * убрать нельзя — down лишь снимает его с записей.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_studio_activity_action" ADD VALUE IF NOT EXISTS 'invite';`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   UPDATE "studio_activity" SET "action" = 'create' WHERE "action" = 'invite';`)
}
