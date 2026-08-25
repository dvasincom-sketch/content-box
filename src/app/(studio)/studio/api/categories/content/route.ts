import { withAuthor, apiError, belongsToTenant } from '@/app/(studio)/studio/api/_lib'
import { mergeContentOrder } from '@/lib/categoryContentOrder'
import { NextResponse } from 'next/server'

/**
 * Содержимое категории для редактора порядка (drag-and-drop): подкатегории +
 * публикации, привязанные к разделу (основная ИЛИ дополнительная категория),
 * уже слитые в текущий эффективный порядок (сохранённый contentOrder + хвост
 * новых элементов). Студия рисует этот список и даёт его перетаскивать.
 *
 * GET /studio/api/categories/content?id=<catId>
 * Ответ: { items: [{ k:'c'|'p', id, title, coverUrl }] }
 */
export const GET = withAuthor(async ({ req, payload, tenantId }) => {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return apiError('Не указана категория')
  if (!(await belongsToTenant(payload, 'categories', id, tenantId))) {
    return apiError('Категория не найдена', 404)
  }

  const cat: any = await payload
    .findByID({ collection: 'categories', id, depth: 0, overrideAccess: true })
    .catch(() => null)
  if (!cat) return apiError('Категория не найдена', 404)

  // Подкатегории (в дефолтном порядке по 'order'), публикации раздела (по дате).
  const [childrenRes, pubsRes] = await Promise.all([
    payload.find({
      collection: 'categories',
      where: { and: [{ tenant: { equals: tenantId } }, { parent: { equals: cat.id } }] },
      sort: 'order',
      limit: 500,
      depth: 1,
      overrideAccess: true,
    }),
    payload.find({
      collection: 'publications',
      where: {
        and: [
          { tenant: { equals: tenantId } },
          { or: [{ category: { equals: cat.id } }, { extraCategories: { in: [cat.id] } }] },
        ],
      },
      sort: '-publishedAt',
      limit: 500,
      depth: 1,
      overrideAccess: true,
    }),
  ])

  const children = childrenRes.docs as any[]
  const pubs = pubsRes.docs as any[]

  const catById = new Map<number, any>(children.map((c) => [Number(c.id), c]))
  const pubById = new Map<number, any>(pubs.map((p) => [Number(p.id), p]))

  const merged = mergeContentOrder({
    order: cat.contentOrder,
    catIds: children.map((c) => c.id),
    pubIds: pubs.map((p) => p.id),
  })

  const items = merged.map((ref) => {
    if (ref.k === 'c') {
      const c = catById.get(ref.id)
      return { k: 'c' as const, id: ref.id, title: c?.title || 'Без названия', coverUrl: coverUrlOf(c?.cover) }
    }
    const p = pubById.get(ref.id)
    return { k: 'p' as const, id: ref.id, title: p?.title || 'Без заголовка', coverUrl: coverUrlOf(p?.cover) }
  })

  return NextResponse.json({ items })
})

/** Небольшое превью из upload-поля (thumbnail/card/url). */
function coverUrlOf(cover: unknown): string | null {
  if (!cover || typeof cover !== 'object') return null
  const c = cover as any
  return c.sizes?.thumbnail?.url || c.sizes?.card?.url || c.url || null
}
