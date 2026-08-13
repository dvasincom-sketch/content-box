import { withAuthor, apiOk } from '@/app/(studio)/studio/api/_lib'

/**
 * Поиск/резолв публикаций для блока «Публикации» конструктора.
 * GET ?q=текст → до 20 совпадений по названию; ?ids=1,2,3 → эти публикации.
 * Только свой тенант. { items: [{ id, slug, title, posterUrl }] }
 */
export const runtime = 'nodejs'

export const GET = withAuthor(async ({ req, payload, tenantId }) => {
  const sp = req.nextUrl.searchParams
  const q = (sp.get('q') || '').trim().slice(0, 100)
  const idsParam = (sp.get('ids') || '').trim()
  const and: any[] = [{ tenant: { equals: tenantId } }]
  let limit = 20
  if (idsParam) {
    const ids = idsParam.split(',').map((x) => x.trim()).filter(Boolean).slice(0, 100)
    if (!ids.length) return apiOk({ items: [] })
    and.push({ id: { in: ids } })
    limit = 100
  } else if (q) {
    and.push({ title: { like: q } })
  }
  const res = await payload
    .find({ collection: 'publications', where: { and }, sort: '-publishedAt', limit, depth: 1, overrideAccess: true })
    .catch(() => ({ docs: [] as any[] }))
  const items = (res.docs as any[]).map((p) => {
    const c = p.cover && typeof p.cover === 'object' ? p.cover : null
    return { id: p.id, slug: String(p.slug || ''), title: String(p.title || ''), posterUrl: c?.sizes?.card?.url || c?.sizes?.poster?.url || c?.url || null }
  })
  return apiOk({ items })
})
