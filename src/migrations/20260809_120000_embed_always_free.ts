import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Разовая нормализация доступа для внешних вставок (provider='embed').
 *
 * Внешнее видео физически лежит на чужой площадке (VK, Дзен) и закрыть его
 * подпиской технически невозможно. Раньше автор мог выставить ему платный
 * уровень — получался «замок» на видео, которое всё равно открыто на VK
 * (нечестно к подписчикам). Новое правило (хук enforceAccessPolicy) форсит
 * такие видео бесплатными при сохранении; здесь чиним УЖЕ существующие записи:
 * снимаем уровень доступа и помечаем их бесплатным превью.
 *
 * Своё видео (наше хранилище) НЕ трогаем — его политику доступа автор задаёт
 * сам, и здесь мы не хотим внезапно перекрывать бесплатные записи.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    UPDATE "videos"
    SET "min_tier_id" = NULL,
        "is_preview" = true
    WHERE "provider" = 'embed'
      AND ("min_tier_id" IS NOT NULL OR "is_preview" = false);`)
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  // Необратимо: прежние уровни доступа для внешних вставок не сохраняем.
}
