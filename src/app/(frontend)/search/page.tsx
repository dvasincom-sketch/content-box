import type { Metadata } from 'next'
import { headers } from 'next/headers'
import Link from 'next/link'
import { resolveViewerTenantSSR } from '@/search/tenant'
import { runSearch } from '@/search/query'
import { rateLimit, clientIp } from '@/lib/rateLimit'
import { SearchBox } from '@/components/search/SearchBox'
import { highlight } from '@/components/search/highlight'
import styles from '@/components/search/search.module.css'

/** Верхняя граница длины запроса: длиннее — это уже не поиск, а нагрузка. */
const MAX_QUERY_LEN = 200

export const dynamic = 'force-dynamic'

// Results pages have no SEO value (thin/duplicate content) — keep them out of Google.
export const metadata: Metadata = { robots: { index: false, follow: true } }

const TYPE_LABELS: Record<string, string> = {
  publication: 'Публикации',
  category: 'Категории',
  video: 'Видео',
  page: 'Страницы',
}

type SP = Record<string, string | string[] | undefined>
const str = (v: string | string[] | undefined): string | undefined =>
  typeof v === 'string' ? v : undefined

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<SP>
}) {
  const sp = await searchParams
  // Обрезка длины: полный поиск идёт ЧЕРЕЗ ЭТУ СТРАНИЦУ, а не через /api/search
  // (тот роут вызывается только извне — SearchBox дергает лишь /suggest).
  // Значит и лимит, и ограничение длины запроса нужны здесь, иначе
  // `?q=<50 КБ>` в цикле бьёт в Meilisearch без всякого учёта.
  const q = (str(sp.q) ?? '').trim().slice(0, MAX_QUERY_LEN)
  const type = str(sp.type)
  const category = str(sp.category)
  const page = Math.max(1, Number(str(sp.page) ?? '1') || 1)
  const includeLocked = (str(sp.locked) ?? '1') !== '0'

  // Reads x-tenant-id injected by proxy.ts for this frontend request.
  const tenant = await resolveViewerTenantSSR()

  // Лимит проверяем только когда запрос непустой — открытие пустой страницы
  // поиска в Meilisearch не ходит и расходовать попытку не должно.
  const throttled = q ? !rateLimit(`search-page:${clientIp(await headers())}`, 60, 60_000).ok : false

  const result =
    tenant && q && !throttled
      ? await runSearch({
          tenantId: tenant.id,
          viewerTier: tenant.viewerTier,
          q,
          type,
          category,
          page,
          includeLocked,
        })
      : null

  const hrefWith = (patch: Record<string, string | undefined>): string => {
    const merged: Record<string, string | undefined> = {
      q,
      type,
      category,
      page: String(page),
      locked: includeLocked ? '1' : '0',
      ...patch,
    }
    const params = new URLSearchParams()
    for (const [k, v] of Object.entries(merged)) {
      if (!v) continue
      if (k === 'locked' && v === '1') continue
      if (k === 'page' && v === '1') continue
      params.set(k, v)
    }
    const s = params.toString()
    return s ? `/search?${s}` : '/search'
  }

  const typeFacets = result?.facets?.type ?? {}

  return (
    <main className={styles.page}>
      <SearchBox initialQuery={q} initialIncludeLocked={includeLocked} />

      {!q && (
        <p className={styles.hint}>
          Введите запрос, чтобы искать по публикациям, видео, категориям и страницам.
        </p>
      )}

      {q && !tenant && <p className={styles.hint}>Сайт не найден.</p>}

      {q && tenant && throttled && (
        <p className={styles.hint}>Слишком много запросов подряд. Подождите минуту и попробуйте снова.</p>
      )}

      {q && result && (
        <>
          {Object.keys(typeFacets).length > 0 && (
            <nav className={styles.facets} aria-label="Фильтр по типу">
              <Link
                href={hrefWith({ type: undefined, page: '1' })}
                className={!type ? styles.facetActive : styles.facet}
              >
                Все
              </Link>
              {Object.entries(typeFacets).map(([t, count]) => (
                <Link
                  key={t}
                  href={hrefWith({ type: t, page: '1' })}
                  className={type === t ? styles.facetActive : styles.facet}
                >
                  {TYPE_LABELS[t] ?? t} ({count})
                </Link>
              ))}
            </nav>
          )}

          {result.totalHits === 0 ? (
            <p className={styles.hint}>Ничего не найдено. Попробуйте изменить запрос.</p>
          ) : (
            <ul className={styles.results}>
              {result.hits.map((h) => (
                <li key={h.id}>
                  <Link
                    href={h.url}
                    className={`${styles.itemLink} c-spotlight`}
                  >
                    {h.thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={h.thumb} alt="" className={styles.thumb} />
                    ) : (
                      <span className={styles.thumbPlaceholder} aria-hidden />
                    )}
                    <span className={styles.itemBody}>
                      <span
                        className={styles.itemTitle}
                        dangerouslySetInnerHTML={{ __html: highlight(h.title) }}
                      />
                      {h.locked ? (
                        <span className={styles.lock}>🔒 Доступно по подписке</span>
                      ) : h.excerpt ? (
                        <span
                          className={styles.excerpt}
                          dangerouslySetInnerHTML={{ __html: highlight(h.excerpt) }}
                        />
                      ) : null}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {result.totalPages > 1 && (
            <nav className={styles.pager} aria-label="Пагинация">
              {page > 1 ? (
                <Link href={hrefWith({ page: String(page - 1) })}>← Назад</Link>
              ) : (
                <span className={styles.pagerDisabled}>← Назад</span>
              )}
              <span>
                Стр. {result.page} из {result.totalPages}
              </span>
              {page < result.totalPages ? (
                <Link href={hrefWith({ page: String(page + 1) })}>Вперёд →</Link>
              ) : (
                <span className={styles.pagerDisabled}>Вперёд →</span>
              )}
            </nav>
          )}

          {result.totalHits > 0 && (
            <div className={styles.resultsFooter}>
              Найдено {result.totalHits} · {result.processingTimeMs} мс
            </div>
          )}
        </>
      )}
    </main>
  )
}
