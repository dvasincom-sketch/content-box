import { withAuthor, apiOk, apiError } from '@/app/(studio)/studio/api/_lib'
import { publishedWhere } from '@/lib/published'

/**
 * Превью «Ряда-постеры» для конструктора: постеры публикаций выбранной категории.
 * GET ?categoryId=123 → { title, items: [{ href, title, posterUrl }] }
 * Только свой тенант; отдаём немного (для превью в редакторе).
 */
export const runtime = 'nodejs'

export const GET = withAuthor(async ({ req, payload, tenantId }) => {
  const id = req.nextUrl.searchParams.get('categoryId')
  if (!id) return apiError('Не указана категория')

  const cat: any = /^\d+$/.test(id)
    ? await payload.findByID({ collection: 'categories', id, depth: 0, overrideAccess: true }).catch(() => null)
    : ((await payload.find({ collection: 'categories', where: { and: [{ tenant: { equals: tenantId } }, { slug: { equals: id } }] }, limit: 1, depth: 0, overrideAccess: true }).catch(() => ({ docs: [] as any[] }))).docs[0] || null)
  if (!cat || String(cat.tenant?.id ?? cat.tenant) !== String(tenantId)) return apiError('Категория не найдена', 404)

  const rp = await payload
    .find({
      collection: 'publications',
      where: { and: [{ tenant: { equals: tenantId } }, { category: { equals: cat.id } }, publishedWhere()] },
      sort: '-publishedAt',
      limit: 12,
      depth: 1,
      overrideAccess: true,
    })
    .catch(() => ({ docs: [] as any[] }))

  const items = (rp.docs as any[]).map((p) => {
    const c = p.cover && typeof p.cover === 'object' ? p.cover : null
    return { href: `/publication/${p.slug}`, title: String(p.title || ''), posterUrl: c?.sizes?.poster?.url || c?.sizes?.card?.url || c?.url || null }
  })

  return apiOk({ title: String(cat.title || ''), items: items })
})
