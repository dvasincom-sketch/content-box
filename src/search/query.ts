import { contentIndex } from './meili'

/** Highlight sentinels — swapped for <mark> after HTML-escaping on render (XSS-safe). */
export const HL_PRE = '[[hl]]'
export const HL_POST = '[[/hl]]'

export type SearchHit = {
  id: string
  type: string
  url: string
  thumb: string | null
  date: number
  locked: boolean
  title: string // may contain HL sentinels
  excerpt: string | null // may contain HL sentinels; null when locked
}

export type SearchResult = {
  query: string
  page: number
  totalPages: number
  totalHits: number
  processingTimeMs: number
  facets: Record<string, Record<string, number>>
  hits: SearchHit[]
}

export type SearchArgs = {
  tenantId: string
  viewerTier: number
  q: string
  type?: string | null
  category?: string | null
  page?: number
  limit?: number
  /** Toggle "Искать в закрытом контенте" — default true. */
  includeLocked?: boolean
}

/** Shared by /api/search AND the SSR /search page (no self-HTTP). */
export async function runSearch(args: SearchArgs): Promise<SearchResult> {
  const page = Math.max(1, args.page ?? 1)
  const hitsPerPage = Math.min(50, Math.max(1, args.limit ?? 20))
  const includeLocked = args.includeLocked ?? true

  const filter = [`tenant = "${args.tenantId}"`]
  if (args.type) filter.push(`type = "${args.type}"`)
  if (args.category) filter.push(`categoryId = "${args.category}"`)
  if (!includeLocked) filter.push(`minTierWeight <= ${args.viewerTier}`)

  const res = await contentIndex().search(args.q, {
    filter: filter.join(' AND '),
    facets: ['type', 'categoryId'],
    page,
    hitsPerPage,
    attributesToHighlight: ['title', 'body'],
    highlightPreTag: HL_PRE,
    highlightPostTag: HL_POST,
    attributesToCrop: ['body'],
    cropLength: 30,
  })

  const hits: SearchHit[] = (res.hits as any[]).map((h) => {
    const locked = Number(h.minTierWeight ?? 0) > args.viewerTier
    return {
      id: h.id,
      type: h.type,
      url: h.url,
      thumb: h.thumb ?? null,
      date: h.date ?? 0,
      locked,
      title: h._formatted?.title ?? h.title ?? '',
      excerpt: locked ? null : h._formatted?.body ?? '',
    }
  })

  return {
    query: args.q,
    page: (res as any).page ?? 1,
    totalPages: (res as any).totalPages ?? 1,
    totalHits: (res as any).totalHits ?? hits.length,
    processingTimeMs: (res as any).processingTimeMs ?? 0,
    facets: (res.facetDistribution as Record<string, Record<string, number>>) ?? {},
    hits,
  }
}

export type SuggestArgs = {
  tenantId: string
  viewerTier: number
  q: string
  includeLocked?: boolean
  limit?: number
}

/** Lightweight typeahead — titles only, small limit. Shared by /api/search/suggest. */
export async function runSuggest(args: SuggestArgs): Promise<SearchHit[]> {
  const includeLocked = args.includeLocked ?? true

  const filter = [`tenant = "${args.tenantId}"`]
  if (!includeLocked) filter.push(`minTierWeight <= ${args.viewerTier}`)

  const res = await contentIndex().search(args.q, {
    filter: filter.join(' AND '),
    limit: Math.min(12, Math.max(1, args.limit ?? 8)),
    attributesToRetrieve: ['id', 'type', 'title', 'url', 'thumb', 'minTierWeight'],
    attributesToHighlight: ['title'],
    highlightPreTag: HL_PRE,
    highlightPostTag: HL_POST,
  })

  return (res.hits as any[]).map((h) => ({
    id: h.id,
    type: h.type,
    url: h.url,
    thumb: h.thumb ?? null,
    date: 0,
    locked: Number(h.minTierWeight ?? 0) > args.viewerTier,
    title: h._formatted?.title ?? h.title ?? '',
    excerpt: null,
  }))
}
