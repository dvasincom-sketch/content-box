import { withAuthor, apiError, apiOk, isContributor } from '@/app/(studio)/studio/api/_lib'

/**
 * Таймлайн действий одного зрителя для дашборда (drawer «Пользователи»).
 * Только владелец студии. Отдаёт последние события с разрешёнными подписями и
 * ссылками на объекты (подписи резолвим на чтении — всегда свежие).
 */
export const GET = withAuthor(async ({ req, payload, tenantId, author }) => {
  if (isContributor(author)) return apiError('Доступно только владельцу студии', 403)
  const url = new URL(req.url)
  const subscriberId = url.searchParams.get('subscriber')
  if (!subscriberId) return apiError('Не указан пользователь', 400)

  const res = await payload.find({
    collection: 'subscriber-activity' as any,
    where: { and: [{ tenant: { equals: tenantId } }, { subscriber: { equals: subscriberId } }] },
    sort: '-createdAt',
    limit: 200,
    depth: 0,
    overrideAccess: true,
  })
  const rows = res.docs as any[]

  // Собираем id по типам для батч-резолва подписей/ссылок.
  const byType: Record<string, Set<string>> = {}
  for (const r of rows) {
    if (r.targetType && r.targetId) (byType[r.targetType] ??= new Set()).add(String(r.targetId))
  }
  const label: Record<string, { title: string; url: string | null }> = {}
  const key = (t: string, id: string | number) => `${t}:${id}`

  async function resolve(collection: string, type: string, urlFn: (d: any) => string | null, titleFn: (d: any) => string) {
    const ids = byType[type] ? Array.from(byType[type]) : []
    if (!ids.length) return
    const found = await payload
      .find({ collection: collection as any, where: { id: { in: ids } }, limit: 500, depth: 0, overrideAccess: true })
      .catch(() => ({ docs: [] as any[] }))
    for (const d of found.docs as any[]) label[key(type, d.id)] = { title: titleFn(d), url: urlFn(d) }
  }

  await Promise.all([
    resolve('publications', 'publication', (d) => (d.slug ? `/publication/${d.slug}` : null), (d) => d.title || 'Публикация'),
    resolve('videos', 'video', () => null, (d) => d.title || 'Видео'),
    resolve('books', 'book', (d) => (d.slug ? `/book/${d.slug}` : null), (d) => d.title || 'Книга'),
    resolve('subscribers', 'subscriber', (d) => (d.handle ? `/u/${d.handle}` : null), (d) => d.displayName || d.email || 'Профиль'),
    resolve('subscription-tiers', 'tier', () => null, (d) => d.name || 'Тариф'),
  ])

  const events = rows.map((r) => {
    const lk = r.targetType && r.targetId ? label[key(r.targetType, r.targetId)] : undefined
    return {
      id: r.id,
      action: r.action as string,
      targetType: r.targetType || null,
      targetTitle: lk?.title || null,
      targetUrl: lk?.url || null,
      meta: r.meta || null,
      at: r.createdAt as string,
    }
  })
  return apiOk({ events, total: res.totalDocs })
})
