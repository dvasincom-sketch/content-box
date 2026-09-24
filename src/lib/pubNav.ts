import type { Payload } from 'payload'
import { publishedWhere } from '@/lib/published'
import { mergeContentOrder } from '@/lib/categoryContentOrder'
import type { PostNavItem } from '@/blocks/PostNavBlock'

/**
 * Соседи «предыдущая/следующая» для навигации внизу материала.
 *
 * Общий принцип: соседи считаются НЕ по всему сайту, а внутри того же раздела и
 * в ТОМ ЖЕ порядке, в котором раздел показывает свой список (ручной порядок
 * перетаскиванием, если включён у раздела; иначе — по дате, новые сверху). Так
 * «предыдущая/следующая» = ровно те карточки, что стоят до и после этой в
 * списке раздела. Не зависит от даты публикации (чинит пустоту на профилях).
 */

const CAP = 1000

function idOf(rel: unknown): number | string | null {
  if (rel == null) return null
  return typeof rel === 'object' ? (rel as { id: number | string }).id : (rel as number | string)
}

function coverUrl(doc: any): string | null {
  const c = doc?.cover && typeof doc.cover === 'object' ? doc.cover : null
  return c?.sizes?.card?.url || c?.sizes?.large?.url || c?.url || null
}

/**
 * Соседи ПУБЛИКАЦИИ (статья/песня/…) внутри её категории. Область — самая
 * КОНКРЕТНАЯ (глубокая в дереве) из категорий публикации: основная и
 * дополнительные. Так для песни это её альбом, а не общий «Переводы песен».
 */
export async function publicationNeighbors(
  payload: Payload,
  tenantId: number | string,
  pub: any,
): Promise<{ prev: PostNavItem | null; next: PostNavItem | null }> {
  const candIds = [idOf(pub?.category), ...(Array.isArray(pub?.extraCategories) ? pub.extraCategories.map(idOf) : [])]
    .filter((x) => x != null)
    .map(String)
  if (candIds.length === 0) return { prev: null, next: null }

  const catsRes = await payload.find({
    collection: 'categories',
    where: { and: [{ tenant: { equals: tenantId } }, { id: { in: candIds } }] },
    depth: 0,
    limit: 50,
    overrideAccess: true,
  })
  const cats = catsRes.docs as any[]
  if (cats.length === 0) return { prev: null, next: null }

  // Самая конкретная категория = самая глубокая (по числу «хлебных крошек»).
  // При равенстве предпочитаем основную категорию публикации.
  const depthOf = (c: any) => (Array.isArray(c.breadcrumbs) ? c.breadcrumbs.length : 0)
  const primaryId = String(idOf(pub?.category) ?? '')
  cats.sort(
    (a, b) => depthOf(b) - depthOf(a) || (String(a.id) === primaryId ? -1 : String(b.id) === primaryId ? 1 : 0),
  )
  const scope = cats[0]

  // Публикации раздела — те же условия, что и в списке категории: по основной
  // ИЛИ дополнительной категории, опубликованные, без UGC-авторов.
  const sibRes = await payload.find({
    collection: 'publications',
    where: {
      and: [
        { tenant: { equals: tenantId } },
        publishedWhere(),
        { author: { exists: false } },
        { or: [{ category: { equals: scope.id } }, { extraCategories: { in: [scope.id] } }] },
      ],
    },
    sort: '-publishedAt',
    depth: 1,
    limit: CAP,
    overrideAccess: true,
  })
  const docs = sibRes.docs as any[]
  if (docs.length <= 1) return { prev: null, next: null }

  const byId = new Map<string, any>(docs.map((d) => [String(d.id), d]))
  const merged = mergeContentOrder({
    order: scope.manualOrder ? scope.contentOrder : [],
    catIds: [],
    pubIds: docs.map((d) => d.id),
  })
  const ordered = merged
    .filter((r) => r.k === 'p')
    .map((r) => byId.get(String(r.id)))
    .filter(Boolean) as any[]

  const idx = ordered.findIndex((p) => String(p.id) === String(pub.id))
  if (idx < 0) return { prev: null, next: null }

  const catTitle = scope.title ?? null
  const mk = (doc: any, kind: 'prev' | 'next'): PostNavItem => ({
    title: doc?.title ?? '',
    href: `/publication/${doc?.slug}`,
    categoryTitle: catTitle,
    coverUrl: coverUrl(doc),
    isPremium: doc?.minTier != null && doc.minTier !== '',
    kind,
  })
  return {
    prev: idx > 0 ? mk(ordered[idx - 1], 'prev') : null,
    next: idx < ordered.length - 1 ? mk(ordered[idx + 1], 'next') : null,
  }
}

/**
 * Соседи СТРАНИЦЫ-РАЗДЕЛА (участник = категория в режиме «страница») среди
 * сестёр — дочерних категорий того же родителя, в порядке раздела-родителя
 * (ручной, если включён; иначе — по полю order). Ссылки ведут на страницы этих
 * разделов. `slugSegments` — сегменты текущего URL (…/members/j-hope), из них
 * строим адрес соседей, меняя последний сегмент.
 */
export async function siblingCategoryNeighbors(
  payload: Payload,
  tenantId: number | string,
  category: any,
  slugSegments: string[],
): Promise<{ prev: PostNavItem | null; next: PostNavItem | null }> {
  const parentId = idOf(category?.parent)
  if (parentId == null) return { prev: null, next: null }

  const parent = await payload
    .findByID({ collection: 'categories', id: parentId, depth: 0, overrideAccess: true })
    .catch(() => null as any)

  const sibsRes = await payload.find({
    collection: 'categories',
    where: { and: [{ tenant: { equals: tenantId } }, { parent: { equals: parentId } }] },
    sort: 'order',
    depth: 1,
    limit: CAP,
    overrideAccess: true,
  })
  const sibs = sibsRes.docs as any[]
  if (sibs.length <= 1) return { prev: null, next: null }

  const byId = new Map<string, any>(sibs.map((s) => [String(s.id), s]))
  const merged = mergeContentOrder({
    order: parent?.manualOrder ? parent.contentOrder : [],
    catIds: sibs.map((s) => s.id),
    pubIds: [],
  })
  const ordered = merged
    .filter((r) => r.k === 'c')
    .map((r) => byId.get(String(r.id)))
    .filter(Boolean) as any[]

  const idx = ordered.findIndex((c) => String(c.id) === String(category.id))
  if (idx < 0) return { prev: null, next: null }

  const parentSegs = slugSegments.slice(0, -1)
  const hrefFor = (c: any) => `/category/${[...parentSegs, c.slug].filter(Boolean).join('/')}`
  const parentTitle = parent?.title ?? null
  const mk = (c: any, kind: 'prev' | 'next'): PostNavItem => ({
    title: c?.title ?? '',
    href: hrefFor(c),
    categoryTitle: parentTitle,
    coverUrl: coverUrl(c),
    isPremium: false,
    kind,
  })
  return {
    prev: idx > 0 ? mk(ordered[idx - 1], 'prev') : null,
    next: idx < ordered.length - 1 ? mk(ordered[idx + 1], 'next') : null,
  }
}
