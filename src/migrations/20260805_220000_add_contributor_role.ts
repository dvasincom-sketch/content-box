import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Роль тенанта 'contributor' — ограниченный участник студии (создаёт контент и
 * правит только свой). Добавляется значение в enum_users_tenant_role.
 * Отдельной миграцией (только ADD VALUE), как add_perk_excluded.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_users_tenant_role" ADD VALUE IF NOT EXISTS 'contributor';`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Значение из enum PostgreSQL удалить нельзя. Пользователей с этой ролью
  // возвращаем в 'editor', иначе после отката остались бы строки со значением,
  // которого нет в коде (на практике откат этой миграции не используется).
  await db.execute(sql`
   UPDATE "users" SET "tenant_role" = 'editor' WHERE "tenant_role" = 'contributor';`)
}
