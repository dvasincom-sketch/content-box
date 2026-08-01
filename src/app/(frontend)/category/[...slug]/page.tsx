import { getPayload } from 'payload'
import config from '@/payload.config'
import { notFound } from 'next/navigation'
import { Breadcrumbs } from '@/components/Breadcrumbs'
import { getTenantFromHeaders } from '@/lib/tenant'
import { brandVars } from '@/lib/brand'
import { buildMetadata } from '@/lib/seo'
import type { Metadata } from 'next'
import { LatestPublicationsBlock } from '@/blocks/LatestPublicationsBlock'
import { getPublicationCardStats } from '@/lib/publicationCardStats'
import { RichText } from '@/components/RichText'
import { CategoriesGridBlock } from '@/blocks/CategoriesGridBlock'
import { VideoSeriesBlock, type SeriesEpisode } from '@/blocks/VideoSeriesBlock'
import { categoryHref } from '@/lib/categoryHref'
import { CrossLinkCard } from '@/components/CrossLinkCard'
import { publishedWhere } from '@/lib/published'
import '../../styles.css'
import type { Payload } from 'payload'

type Params = { slug: string[] }

/**
 * Категория по полному пути: спускаемся по сегментам от корня.
 * По одному запросу на сегмент (индекс slug + parent_id), точное совпадение.
 * Фильтр по breadcrumbs не годится: крошка `/videography` есть у всех потомков.
 */
async function findCategory(payload: Payload, tenantID: number, segments: string[]) {
  let parentID: number | null = null
  let current: any = null

  for (const segment of segments) {
    const res = await payload.find({
      collection: 'categories',
      where: {
        and: [
          { tenant: { equals: tenantID } },
          { slug: { equals: segment } },
          parentID ? { parent: { equals: parentID } } : { parent: { exists: false } },
        ],
      },
      limit: 1,
      depth: 1,
      overrideAccess: true,
    })

    current = (res.docs as any[])[0]
    if (!current) return null
    parentID = current.id
  }

  return current
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params
  const ctx = await getTenantFromHeaders()
  if (!ctx) return {}
  const { tenant, settings } = ctx

  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })
  const category = await findCategory(payload, tenant.id as number, slug)
  if (!category) notFound()

  return buildMetadata({
    defaults: settings?.seoDefaults,
    levels: [category.seo],
    fallbackTitle: category.title,
    brandName: tenant.name,
  })
}

export default async function CategoryPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params
  const ctx = await getTenantFromHeaders()
  if (!ctx) return <div className="p-8">Тенант не определён.</div>

  const { tenant, settings } = ctx
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })

  const category = await findCategory(payload, tenant.id as number, slug)
  if (!category) notFound()

  // Обратная связка: статья «Мира BTS», привязанная к этой категории «Смотреть»
  // (publications.watchCategory = текущая категория). Запрос по уникальному
  // индексу, limit 1. Пусто на большинстве категорий — блок не рисуется.
  const linkedRes = await payload.find({
    collection: 'publications',
    where: {
      and: [
        { tenant: { equals: tenant.id } },
        { watchCategory: { equals: category.id } },
        publishedWhere(),
      ],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const linkedArticle = (linkedRes.docs as any[])[0] || null

  // Категория-контейнер (posterLayout): её дочерние категории выводятся афишами
  // (постерами 2:3), а публикации ветки на этой странице не показываются —
  // эпизоды живут внутри дочерних разделов.
  const isPosterContainer = Boolean(category.posterLayout)
  const isVideoSeries = Boolean(category.videoSeries)

  // Публикации всей ветки: категории, у которых текущая есть в цепочке предков.
  // Для контейнера не нужны (показываем афиши детей), поэтому не запрашиваем.
  let pubs: any[] = []
  let cardStats = new Map<string, { comments: number; reactions: number }>()
  if (!isPosterContainer && !isVideoSeries) {
    const branchRes = await payload.find({
      collection: 'categories',
      where: {
        and: [{ tenant: { equals: tenant.id } }, { 'breadcrumbs.doc': { equals: category.id } }],
      },
      limit: 500,
      depth: 0,
      overrideAccess: true,
    })
    const branchIDs = (branchRes.docs as any[]).map((c) => c.id)
    if (branchIDs.length === 0) branchIDs.push(category.id)

    // Публикация попадает в раздел по ОСНОВНОЙ или по ДОПОЛНИТЕЛЬНОЙ категории.
    const catMatch: any[] = [
      { category: { in: branchIDs } },
      { extraCategories: { in: branchIDs } },
    ]
    // Витрина «Новинки» (категория со slug 'new'): помимо привязанных к разделу —
    // все публикации с активным флагом «Новинка» (14 дней), независимо от их
    // собственной категории. По истечении окна публикация уходит из витрины и
    // остаётся только в своих категориях.
    if (category.slug === 'new') {
      catMatch.push({
        and: [
          { isNew: { equals: true } },
          { newUntil: { greater_than: new Date().toISOString() } },
        ],
      })
    }

    const pubsRes = await payload.find({
      collection: 'publications',
      where: {
        and: [
          { tenant: { equals: tenant.id } },
          // Без этого черновики ветки попадали в листинг категории, а из-за
          // NULLS FIRST при '-publishedAt' — сразу наверх.
          publishedWhere(),
          { or: catMatch },
        ],
      },
      sort: '-publishedAt',
      depth: 1,
      limit: 50,
      overrideAccess: true,
    })
    pubs = pubsRes.docs as any[]

    // Счётчики комментариев и реакций для карточек — один агрегирующий запрос.
    cardStats = await getPublicationCardStats(
      pubs.map((p) => p.id),
      tenant.id as number,
    )
  }

  // Видео-плейлист: эпизоды — видео, назначенные прямо этой категории.
  // Группировку/сортировку по сезону и порядку делает блок (клиент).
  let seriesEpisodes: SeriesEpisode[] = []
  if (isVideoSeries) {
    const vidsRes = await payload.find({
      collection: 'videos',
      where: { and: [{ tenant: { equals: tenant.id } }, { category: { equals: category.id } }] },
      sort: 'episode',
      depth: 1,
      limit: 500,
      overrideAccess: true,
    })
    seriesEpisodes = (vidsRes.docs as any[]).map((v) => {
      const cover = v.cover && typeof v.cover === 'object' ? v.cover : null
      const coverUrl = cover?.sizes?.thumb?.url || cover?.sizes?.card?.url || cover?.url || null
      return {
        id: v.id,
        title: v.title || 'Без названия',
        slug: v.slug || '',
        coverUrl,
        season: v.season ?? null,
        episode: v.episode ?? null,
        durationSec: v.durationSec ?? null,
        isFree: Boolean(v.isPreview) || !v.minTier,
        minTierName:
          v.minTier && typeof v.minTier === 'object' ? v.minTier.name || v.minTier.slug || null : null,
      }
    })
  }

  // Прямые подкатегории. Для контейнера — это афиши; для обычной категории —
  // плитки под публикациями. depth:1 — нужен cover.
  const childrenRes = await payload.find({
    collection: 'categories',
    where: {
      and: [{ tenant: { equals: tenant.id } }, { parent: { equals: category.id } }],
    },
    sort: 'order',
    limit: 100,
    depth: 1,
    overrideAccess: true,
  })
  const children = childrenRes.docs as any[]

  const crumbs = (category.breadcrumbs ?? []) as { url?: string; label?: string }[]

  return (
    <main className="page-canvas" style={{ ...brandVars(settings), minHeight: '100vh' }}>
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Хлебные крошки */}
        <Breadcrumbs crumbs={crumbs as any} lastIsCurrent className="mb-6" />

        <h1 className="text-3xl lg:text-5xl font-extrabold mb-2" style={{ color: 'var(--brand-text)' }}>
          {category.title}
        </h1>

        {category.description ? (
          <div className="max-w-3xl mx-auto mb-12">
            <RichText data={category.description} />
          </div>
        ) : null}

        {/* Обратная связка → статья-энциклопедия в «Мире BTS» по этой теме. */}
        {linkedArticle && (
          <div className="mb-10" style={{ maxWidth: 640 }}>
            <CrossLinkCard
              href={`/publication/${linkedArticle.slug}`}
              variant="read"
              title={linkedArticle.title}
            />
          </div>
        )}

        {isVideoSeries ? (
          <VideoSeriesBlock episodes={seriesEpisodes} />
        ) : isPosterContainer ? (
          // Контейнер: сетка афиш — прямые дочерние категории вертикальными
          // постерами 2:3. Клик по афише → страница дочерней категории (эпизоды).
          children.length > 0 ? (
            <div className="poster-grid">
              {children.map((c) => {
                const cover = c.cover && typeof c.cover === 'object' ? c.cover : null
                const posterUrl = cover?.sizes?.poster?.url || cover?.url || null
                return (
                  <a
                    key={c.id}
                    href={categoryHref(c)}
                    className="poster-card"
                    title={c.title}
                  >
                    <div className="poster-card__frame">
                      {posterUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={posterUrl}
                          alt={c.title}
                          loading="lazy"
                          className="poster-card__img"
                          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
                        />
                      ) : (
                        <div className="poster-card__placeholder" aria-hidden>
                          {(c.title || '?').slice(0, 1).toUpperCase()}
                        </div>
                      )}
                    </div>
                  </a>
                )
              })}
            </div>
          ) : category.description ? null : (
            <p style={{ color: 'var(--brand-muted)' }}>
              В этом разделе пока нет подразделов.
            </p>
          )
        ) : pubs.length === 0 ? (
          // Если есть статья или подкатегории — раздел не пустой.
          category.description || children.length > 0 ? null : (
            <p style={{ color: 'var(--brand-muted)' }}>
              В этой категории пока нет публикаций.
            </p>
          )
        ) : (
          <LatestPublicationsBlock
            heading=""
            items={pubs.map((p) => {
              const stats = cardStats.get(String(p.id))
              return {
                id: p.id,
                slug: p.slug,
                title: p.title,
                publishedAt: p.publishedAt,
                minTierName:
                  p.minTier && typeof p.minTier === 'object'
                    ? p.minTier.name || p.minTier.slug || null
                    : null,
                cover: p.cover,
                commentCount: stats?.comments ?? 0,
                reactionCount: stats?.reactions ?? 0,
                hasVideo: Array.isArray(p.relatedVideos) && p.relatedVideos.length > 0,
                hasGallery: Array.isArray(p.gallery) && p.gallery.length > 0,
              }
            })}
          />
        )}

        {/* Прямые подкатегории плитками — только для обычной категории.
            У контейнера дети уже показаны афишами выше, дублировать не нужно. */}
        {!isPosterContainer && !isVideoSeries && children.length > 0 && (
          <div className="mt-14">
            <CategoriesGridBlock
              heading="Разделы"
              items={children.map((c) => ({
                id: c.id,
                title: c.title,
                href: categoryHref(c),
                cover: c.cover,
              }))}
            />
          </div>
        )}
      </div>
    </main>
  )
}
