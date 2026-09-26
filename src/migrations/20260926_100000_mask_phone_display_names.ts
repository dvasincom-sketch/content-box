import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Приватность телефона: у подписчиков, которым при входе по SMS в displayName
 * записали телефон, обнуляем это поле. Теперь displayName — опциональный
 * псевдоним, а телефон публично маскируется (+7 (***) ***-45-56).
 *
 * Чистим только «телефонные» значения: без букв и с 10–15 цифрами. Настоящие
 * псевдонимы (с буквами) не трогаем. Откат невозможен (исходное значение —
 * это и был телефон, он остаётся в поле phone).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    UPDATE "subscribers"
    SET "display_name" = NULL
    WHERE "display_name" IS NOT NULL
      AND "display_name" !~ '[A-Za-zА-Яа-яЁё]'
      AND regexp_replace("display_name", '\D', '', 'g') ~ '^[0-9]{10,15}$';`)
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  // Необратимо: значение было телефоном, он сохранён в поле phone.
}
