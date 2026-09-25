import { withAuthor, apiError, apiOk, isContributor } from '@/app/(studio)/studio/api/_lib'

/**
 * Сохранённый чат трансляции для студии (владелец). Показывает всю историю,
 * включая скрытые сообщения, чтобы можно было модерировать задним числом.
 * GET ?stream=<id> → { items, total }.
 */
export const runtime = 'nodejs'

export const GET = withAuthor(async ({ req, payload, tenantId, author }) => {
  if (isContributor(author)) return apiError('Доступно только владельцу студии', 403)
  const streamId = new URL(req.url).searchParams.get('stream')
  if (!streamId) return apiError('Не указана трансляция')

  const s: any = await payload
    .findByID({ collection: 'streams' as any, id: streamId, depth: 0, overrideAccess: true })
    .catch(() => null)
  const st = s && (typeof s.tenant === 'object' ? s.tenant.id : s.tenant)
  if (!s || String(st) !== String(tenantId)) return apiError('Трансляция не найдена', 404)

  const res = await payload.find({
    collection: 'stream-messages' as any,
    where: { and: [{ tenant: { equals: tenantId } }, { stream: { equals: streamId } }] },
    sort: '-createdAt',
    limit: 500,
    depth: 0,
    overrideAccess: true,
  })

  // Кто из авторов сообщений забанен в чате.
  const subIds = Array.from(
    new Set((res.docs as any[]).map((m) => (m.subscriber ? Number(m.subscriber) : null)).filter((x): x is number => x != null)),
  )
  let bannedIds: number[] = []
  if (subIds.length) {
    const b = await payload
      .find({
        collection: 'subscribers',
        where: { and: [{ tenant: { equals: tenantId } }, { id: { in: subIds } }, { chatBanned: { equals: true } }] },
        limit: 500,
        depth: 0,
        overrideAccess: true,
      })
      .catch(() => ({ docs: [] as any[] }))
    bannedIds = (b.docs as any[]).map((x) => Number(x.id))
  }

  const items = (res.docs as any[]).map((m) => ({
    id: m.id,
    name: m.name || 'Зритель',
    text: m.text,
    at: m.createdAt,
    hidden: !!m.hidden,
    pinned: !!m.pinned,
    sub: m.subscriber ? Number(m.subscriber) : null,
  }))
  return apiOk({ items, total: res.totalDocs, bannedIds })
})
