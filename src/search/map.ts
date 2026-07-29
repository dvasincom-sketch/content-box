import type { Payload } from 'payload'
import { extractLexicalText } from '@/utils/lexicalText'

export type ContentType = 'publication' | 'category' | 'video' | 'page'

export type IndexDoc = {
  id: string // "<type>:<docId>" — Meili primaryKey
  tenant: string
  type: ContentType
  categoryId: string | null
  /** Resolved access weight: 0 = free/public; >0 requires a tier with weight >=. */
  minTierWeight: number
  title: string
  body: string
  date: number // unix seconds; drives freshness ranking + sort
  featured: boolean
  url: string
  thumb: string | null
}

/** collection slug -> content type. Gallery images/folders are NOT indexed
 *  standalone (no public route) — publication gallery captions are folded into
 *  the publication body instead. */
export const TYPE_BY_COLLECTION: Record<string, ContentType> = {
  publications: 'publication',
  categories: 'category',
  videos: 'video',
  pages: 'page',
}

export const INDEXED_COLLECTIONS = Object.keys(TYPE_BY_COLLECTION)

export function indexId(collection: string, docId: string | number): string {
  // Meili document ids allow only [a-zA-Z0-9_-] — no ":". Use "_" as separator.
  return `${TYPE_BY_COLLECTION[collection]}_${docId}`
}

function relId(v: unknown): string | null {
  if (v == null) return null
  if (typeof v === 'string' || typeof v === 'number') return String(v)
  if (typeof v === 'object' && 'id' in (v as Record<string, unknown>)) {
    return String((v as Record<string, unknown>).id)
  }
  return null
}

function ts(v: unknown): number {
  if (!v) return 0
  const t = new Date(v as string).getTime()
  return Number.isFinite(t) ? Math.floor(t / 1000) : 0
}

/** Resolve a subscription tier's weight. Empty relation -> 0 (free). */
async function tierWeight(payload: Payload, minTier: unknown): Promise<number> {
  const id = relId(minTier)
  if (!id) return 0
  // Populated object already carries the weight.
  if (typeof minTier === 'object' && minTier && 'weight' in (minTier as any)) {
    return Number((minTier as any).weight ?? 0)
  }
  const tier = await payload
    .findByID({ collection: 'subscription-tiers', id, depth: 0, overrideAccess: true })
    .catch(() => null)
  return Number((tier as any)?.weight ?? 0)
}

/** Resolve a media relation to a thumbnail URL (R2). Prefers the 400px `thumb` size. */
async function mediaThumb(payload: Payload, cover: unknown): Promise<string | null> {
  if (cover && typeof cover === 'object' && ('url' in (cover as any) || 'sizes' in (cover as any))) {
    const m = cover as any
    return m?.sizes?.thumb?.url ?? m?.sizes?.card?.url ?? m?.url ?? null
  }
  const id = relId(cover)
  if (!id) return null
  const m = await payload
    .findByID({ collection: 'media', id, depth: 0, overrideAccess: true })
    .catch(() => null)
  return (m as any)?.sizes?.thumb?.url ?? (m as any)?.sizes?.card?.url ?? (m as any)?.url ?? null
}

/** Category URL from nestedDocs breadcrumbs (full path) or slug fallback. */
function categoryUrl(doc: any): string {
  const crumbs = doc?.breadcrumbs
  if (Array.isArray(crumbs) && crumbs.length > 0) {
    const last = crumbs[crumbs.length - 1]
    if (last?.url) return `/category${last.url}`
  }
  return `/category/${doc?.slug ?? doc?.id}`
}

/**
 * Map a collection doc -> index doc. Async because access weight (tier) and
 * thumbnails (media relation) need resolving. Returns null when not indexable
 * (unknown collection or missing tenant).
 */
export async function mapDoc(
  payload: Payload,
  collection: string,
  doc: any,
): Promise<IndexDoc | null> {
  const type = TYPE_BY_COLLECTION[collection]
  if (!type) return null

  const tenant = relId(doc?.tenant)
  if (!tenant) return null

  const base = {
    id: indexId(collection, doc.id),
    tenant,
    type,
    categoryId: null as string | null,
    minTierWeight: 0,
    title: String(doc?.title ?? ''),
    body: '',
    date: 0,
    featured: false,
    url: '',
    thumb: null as string | null,
  }

  switch (type) {
    case 'publication': {
      // Черновик (publishedAt пуст) в индекс не попадает. Возврат null работает
      // в обе стороны: afterChange-хук по нему УДАЛЯЕТ документ из индекса
      // (см. search/hooks.ts), а полный реиндекс его пропускает. Поэтому снятие
      // с публикации автоматически убирает материал из поиска.
      //
      // ОТЛОЖЕННЫЕ публикации (дата в будущем) здесь НЕ отбрасываются намеренно.
      // Индекс обновляется только по событию записи, и ничто не срабатывает в
      // момент наступления даты — материал пропал бы из поиска навсегда, хотя на
      // сайте появился бы вовремя (там `now` пересчитывается на каждый запрос).
      // Поэтому время фильтруется на стороне ЗАПРОСА: `date <= now` в
      // search/query.ts. Индекс хранит данные, отсечку по времени делает поиск.
      if (!doc?.publishedAt) return null

      // Fold gallery captions into the body so photos are findable via their publication.
      const captions = Array.isArray(doc.gallery)
        ? doc.gallery.map((g: any) => g?.caption).filter(Boolean).join(' ')
        : ''
      return {
        ...base,
        categoryId: relId(doc.category),
        minTierWeight: await tierWeight(payload, doc.minTier),
        body: [extractLexicalText(doc.description), captions].filter(Boolean).join(' '),
        date: ts(doc.publishedAt ?? doc.createdAt),
        featured: Boolean(doc.featured),
        url: `/publication/${doc.slug ?? doc.id}`,
        thumb: await mediaThumb(payload, doc.cover),
      }
    }
    case 'video': {
      return {
        ...base,
        categoryId: relId(doc.category),
        // isPreview overrides gating -> free.
        minTierWeight: doc.isPreview ? 0 : await tierWeight(payload, doc.minTier),
        body: typeof doc.description === 'string' ? doc.description : '',
        date: ts(doc.publishedAt ?? doc.createdAt),
        url: `/video/${doc.slug ?? doc.id}`,
        thumb: await mediaThumb(payload, doc.cover),
      }
    }
    case 'category': {
      return {
        ...base,
        categoryId: String(doc.id),
        title: String(doc.title ?? ''),
        body: [extractLexicalText(doc.description), doc.fullTitle].filter(Boolean).join(' '),
        date: ts(doc.updatedAt ?? doc.createdAt),
        url: categoryUrl(doc),
        thumb: await mediaThumb(payload, doc.cover),
      }
    }
    case 'page': {
      return {
        ...base,
        body: extractLexicalText(doc.content),
        date: ts(doc.updatedAt ?? doc.createdAt),
        url: `/page/${doc.slug ?? doc.id}`,
      }
    }
  }
}
