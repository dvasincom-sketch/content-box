import { getPayload } from 'payload'
import config from '@/payload.config'
import { sqlRows, toIntArray } from '@/lib/sql'

/**
 * Счётчики комментариев и реакций для карточек публикаций в списках.
 *
 * Два агрегирующих запроса с GROUP BY на весь список — независимо от того,
 * сколько всего комментариев и реакций в базе. Раньше здесь выгружались ВСЕ
 * строки (`limit: 10000` и `limit: 20000`) и считались в JS, а функция
 * вызывается 4 раза за рендер главной — то есть до 120 000 строк на один заход.
 * Индексы `comments_publication_idx` / `reactions_publication_idx` и
 * `*_tenant_idx` уже есть, миграция не нужна.
 *
 * Комментарии считаем только опубликованные (status='published') — как на
 * странице публикации. Реакции публикации — targetType='publication'.
 */

export type CardStats = { comments: number; reactions: number }

type CountRow = { id: number; n: number }

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

  const ids = toIntArray(publicationIds)
  if (ids.length === 0) return result

  try {
    const payloadConfig = await config
    const payload = await getPayload({ config: payloadConfig })
    const tenant = Number(tenantId)

    const [comments, reactions] = await Promise.all([
      sqlRows<CountRow>(
        payload,
        `SELECT publication_id AS id, count(*)::int AS n
           FROM comments
          WHERE tenant_id = $1
            AND status = 'published'
            AND publication_id = ANY($2::int[])
          GROUP BY publication_id`,
        [tenant, ids],
      ),
      sqlRows<CountRow>(
        payload,
        `SELECT publication_id AS id, count(*)::int AS n
           FROM reactions
          WHERE tenant_id = $1
            AND target_type = 'publication'
            AND publication_id = ANY($2::int[])
          GROUP BY publication_id`,
        [tenant, ids],
      ),
    ])

    for (const row of comments) {
      const cur = result.get(String(row.id))
      if (cur) cur.comments = Number(row.n) || 0
    }
    for (const row of reactions) {
      const cur = result.get(String(row.id))
      if (cur) cur.reactions = Number(row.n) || 0
    }
  } catch (err) {
    // Коллекций может не быть (миграция не применена) — отдаём нули, как раньше.
    // Но молчать нельзя: обнулённые счётчики выглядят как «нет активности»,
    // а не как сбой.
    console.warn('[publicationCardStats] не удалось посчитать счётчики:', err)
  }

  return result
}
