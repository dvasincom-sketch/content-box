import { Meilisearch, type Index } from 'meilisearch'

export const SEARCH_INDEX = 'content'

let client: Meilisearch | null = null

/**
 * Server-side Meilisearch client. Uses the master/admin key — NEVER expose this
 * to the browser. All browser traffic goes through the Next route handlers
 * (src/app/api/search/*), which apply the tenant filter server-side.
 *
 * meilisearch-js v0.60: class is `Meilisearch` (lowercase s).
 */
/**
 * Задан ли бэкенд поиска. Позволяет мягко отключать поиск там, где Meilisearch
 * не поднят (напр. локальная разработка без docker-compose.meili) — без падений
 * и без шумных стеков в логах.
 */
export function isMeiliConfigured(): boolean {
  return Boolean(process.env.MEILI_HOST && process.env.MEILI_MASTER_KEY)
}

export function getMeili(): Meilisearch {
  if (!client) {
    const host = process.env.MEILI_HOST
    const apiKey = process.env.MEILI_MASTER_KEY
    if (!host || !apiKey) {
      throw new Error('[search] MEILI_HOST / MEILI_MASTER_KEY are not set')
    }
    client = new Meilisearch({ host, apiKey })
  }
  return client
}

export function contentIndex(): Index {
  return getMeili().index(SEARCH_INDEX)
}

/**
 * Platform-level manual synonym dictionary (Phase 1 morphology mitigation).
 * Bidirectional: list both directions. Grow this from logs of empty-result queries.
 */
export const SYNONYMS: Record<string, string[]> = {
  фильм: ['кино', 'картина', 'лента'],
  кино: ['фильм', 'картина', 'лента'],
  фото: ['снимок', 'фотография', 'кадр'],
  фотография: ['фото', 'снимок', 'кадр'],
  видео: ['ролик', 'клип'],
  // TODO: расширять по логам пустых запросов
}

/**
 * Idempotent: create the index (primaryKey = "id") and push settings.
 * Run on deploy (see plugin.ts onInit) and inside the bootstrap reindex.
 *
 * v0.60: mutating methods return an EnqueuedTaskPromise — await `.waitTask()`
 * to block until the task actually finishes.
 */
export async function ensureSearchIndex(): Promise<void> {
  const meili = getMeili()

  // Create with primaryKey. If it already exists the task fails harmlessly — ignore.
  await meili
    .createIndex(SEARCH_INDEX, { primaryKey: 'id' })
    .waitTask()
    .catch(() => undefined)

  await meili.index(SEARCH_INDEX).updateSettings({
    // title first => higher weight than body
    searchableAttributes: ['title', 'body'],
    filterableAttributes: ['tenant', 'type', 'categoryId', 'minTierWeight'],
    sortableAttributes: ['date'],
    displayedAttributes: [
      'id', 'tenant', 'type', 'categoryId', 'minTierWeight',
      'title', 'date', 'featured', 'url', 'thumb',
    ],
    // relevance first, then featured, then freshness
    rankingRules: [
      'words', 'typo', 'proximity', 'attribute', 'sort', 'exactness',
      'featured:desc', 'date:desc',
    ],
    typoTolerance: {
      enabled: true,
      minWordSizeForTypos: { oneTypo: 4, twoTypos: 8 },
    },
    synonyms: SYNONYMS,
    stopWords: [],
  }).waitTask()
}
