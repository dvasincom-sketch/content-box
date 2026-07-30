import { homeFeedTag } from '@/lib/cacheTags'

/**
 * Сброс кэша ленты главной для одного тенанта.
 *
 * Вешается на записи, которые ленту меняют: публикации (состав секций),
 * комментарии и реакции (счётчики карточек, «популярное», «обсуждаемое»).
 * Тег сбрасывает только своего тенанта — соседние сайты не трогаются.
 *
 * Всё завёрнуто в try/catch и динамический импорт по трём причинам:
 *  - `revalidateTag` доступен только в рантайме Next; Payload же поднимается и
 *    в CLI-скриптах (миграции, реиндекс, сиды), где его нет вовсе;
 *  - вызов вне контекста запроса в некоторых версиях Next бросает;
 *  - протухший на час кэш — это неприятно, а упавшее сохранение материала в
 *    студии — это поломка. Приоритет очевиден.
 */
export async function revalidateHomeFeed(tenantId: unknown): Promise<void> {
  const id = relId(tenantId)
  if (!id) return
  try {
    const { revalidateTag } = await import('next/cache')
    // Второй аргумент в Next 16 обязателен: `{ expire: 0 }` = погасить запись
    // немедленно. Без него Next пишет предупреждение об устаревшем вызове.
    revalidateTag(homeFeedTag(id), { expire: 0 })
  } catch {
    // вне рантайма Next — молча пропускаем, кэш сам протухнет по TTL
  }
}

function relId(v: unknown): string | null {
  if (v == null) return null
  if (typeof v === 'object') {
    const id = (v as { id?: string | number }).id
    return id == null ? null : String(id)
  }
  return String(v)
}
