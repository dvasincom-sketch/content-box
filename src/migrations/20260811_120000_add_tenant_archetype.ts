import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Архетип проекта автора (`tenants.archetype`) — «что создаёшь»: writer/video/
 * course/podcast/expert/studio. Выбирается в мастере онбординга, задаёт дефолтный
 * тема-пресет и подсказки. `course` — значение зарезервировано (пока «Скоро»).
 *
 * Тип колонки по образцу `tenants.category`: select → enum
 * (`enum_tenants_archetype`).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_tenants_archetype" AS ENUM('writer', 'video', 'course', 'podcast', 'expert', 'studio');
  ALTER TABLE "tenants" ADD COLUMN "archetype" "enum_tenants_archetype";`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "tenants" DROP COLUMN "archetype";
  DROP TYPE "public"."enum_tenants_archetype";`)
}
