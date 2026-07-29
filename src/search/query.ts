import { contentIndex, isMeiliConfigured } from './meili'

/** Highlight sentinels — swapped for <mark> after HTML-escaping on render (XSS-safe). */
export const HL_PRE = '[[hl]]'
export const HL_POST = '[[/hl]]'

/**
 * Литерал для фильтра Meilisearch с экранированием.
 *
 * Раньше значения подставлялись в строку фильтра как есть, а `type` и
 * `category` приходили сырыми из query-строки. Значение вида `x" OR tenant = "7`
 * разрывало выражение: `AND` связывает сильнее `OR`, поэтому условие по своему
 * тенанту переставало действовать и выдача уходила в чужой индекс.
 */
export function filterLiteral(value: string | number): string {
  return `"${String(value).replace(/[\\"]/g, (c) => `\\${c}`)}"`
}

/**
 * Отсечка отложенных материалов: в индексе `date` — unix-секунды даты публикации.
 *
 * Почему на стороне запроса, а не индексации: индекс обновляется только по
 * событию записи документа, и в момент наступления даты публикации ничто не
 * срабатывает. Если бы отложенный материал не индексировался, он пропал бы из
 * поиска НАВСЕГДА, хотя на сайте появился бы вовремя. Поэтому индекс хранит
 * данные, а время отсекает запрос — так граница пересчитывается на каждый поиск.
 *
 * Материалы без даты получают `date: 0` и условие проходят: у категорий и
 * страниц дата — это updatedAt, отложенной публикации у них не бывает.
 */
export function notScheduledFilter(nowMs?: number): string {
  return `date <= ${Math.floor((nowMs ?? Date.now()) / 1000)}`
}

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
  // Бэкенд поиска не поднят → пустой результат без падения (dev без Meilisearch).
  if (!isMeiliConfigured()) {
    return {
      query: args.q,
      page: 1,
      totalPages: 0,
      totalHits: 0,
      processingTimeMs: 0,
      facets: {},
      hits: [],
    }
  }

  // Number(...) на входе может дать NaN — он бы прошёл сквозь Math.max.
  const page = safeInt(args.page, 1, 1, 10_000)
  const hitsPerPage = safeInt(args.limit, 20, 1, 50)
  const includeLocked = args.includeLocked ?? true

  const filter = [`tenant = ${filterLiteral(args.tenantId)}`, notScheduledFilter()]
  if (args.type) filter.push(`type = ${filterLiteral(args.type)}`)
  if (args.category) filter.push(`categoryId = ${filterLiteral(args.category)}`)
  if (!includeLocked) filter.push(`minTierWeight <= ${safeInt(args.viewerTier, 0, 0, 1_000_000)}`)

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
  // Бэкенд поиска не поднят → пустые подсказки без падения (dev без Meilisearch).
  if (!isMeiliConfigured()) return []

  const includeLocked = args.includeLocked ?? true

  const filter = [`tenant = ${filterLiteral(args.tenantId)}`, notScheduledFilter()]
  if (!includeLocked) filter.push(`minTierWeight <= ${safeInt(args.viewerTier, 0, 0, 1_000_000)}`)

  const res = await contentIndex().search(args.q, {
    filter: filter.join(' AND '),
    limit: safeInt(args.limit, 8, 1, 12),
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

/** Целое в заданных границах; NaN/Infinity/мусор → fallback. */
function safeInt(v: unknown, fallback: number, min: number, max: number): number {
  const n = Math.trunc(Number(v))
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}
