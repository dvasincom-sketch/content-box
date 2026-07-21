import { getPayload } from 'payload'
import config from '@/payload.config'

/**
 * Счётчики комментариев и реакций для карточек публикаций в списках.
 *
 * Один запрос на весь список (не по запросу на карточку): берём все id
 * публикаций, собираем counts из comments и reactions, раскладываем по id.
 *
 * Комментарии считаем только опубликованные (status='published') — как на
 * странице публикации. Реакции публикации — targetType='publication'.
 *
 * Замечание по масштабу: при большом числе реакций это место — кандидат на
 * SQL-агрегацию (GROUP BY). На текущих объёмах JS-подсчёт дёшев и достаточен.
 */

export type CardStats = { comments: number; reactions: number }

export async function getPublicationCardStats(
  publicationIds: Array<string | number>,
  tenantId: string | number,
): Promise<Map<string, CardStats>> {
  const result = new Map<string, CardStats>()
  if (publicationIds.length === 0) return result

  // инициализируем нулями, чтобы у каждой карточки был объект
  for (const id of publicationIds) {
    result.set(String(id), { comments: 0, reactions: 0 })
  }

  try {
    const payloadConfig = await config
    const payload = await getPayload({ config: payloadConfig })

    // ── Комментарии (published) по всем публикациям списка ──
    const commentsRes = await payload.find({
      collection: 'comments',
      where: {
        and: [
          { publication: { in: publicationIds } },
          { tenant: { equals: tenantId } },
          { status: { equals: 'published' } },
        ],
      },
      depth: 0,
      limit: 10000,
      overrideAccess: true,
    })
    for (const c of (commentsRes as any)?.docs ?? []) {
      const pid = String(typeof c.publication === 'object' ? c.publication?.id : c.publication)
      const cur = result.get(pid)
      if (cur) cur.comments += 1
    }

    // ── Реакции публикаций списка ──
    const reactionsRes = await payload.find({
      collection: 'reactions',
      where: {
        and: [
          { targetType: { equals: 'publication' } },
          { publication: { in: publicationIds } },
          { tenant: { equals: tenantId } },
        ],
      },
      depth: 0,
      limit: 20000,
      overrideAccess: true,
    })
    for (const r of (reactionsRes as any)?.docs ?? []) {
      const pid = String(typeof r.publication === 'object' ? r.publication?.id : r.publication)
      const cur = result.get(pid)
      if (cur) cur.reactions += 1
    }
  } catch {
    // коллекций может не быть (миграция не применена) — вернём нули
  }

  return result
}
