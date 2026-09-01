import { getPayload } from 'payload'
import config from '@/payload.config'
import { videoThumbUrl, videoGifUrl } from '@/lib/videoThumb'
import { notFound } from 'next/navigation'
import { Breadcrumbs } from '@/components/Breadcrumbs'
import { getTenantFromHeaders } from '@/lib/tenant'
import { brandVars } from '@/lib/brand'
import { buildMetadata } from '@/lib/seo'
import type { Metadata } from 'next'
import { getPublicationCardStats } from '@/lib/publicationCardStats'
import { ListPagination } from '@/components/ListPagination'
import { RichText } from '@/components/RichText'
import { VideoSeriesBlock, type SeriesEpisode } from '@/blocks/VideoSeriesBlock'
import { VideoCardsBlock } from '@/blocks/VideoCardsBlock'
import { VpnVideoNotice } from '@/components/VpnVideoNotice'
import { categoryHref } from '@/lib/categoryHref'
import { ProfileView } from '@/app/(frontend)/publication/[slug]/ProfileView'
import { CrossLinkCard } from '@/components/CrossLinkCard'
import { publishedWhere } from '@/lib/published'
import { CategoryContentGrid, type CategoryContentItem } from '@/blocks/CategoryContentGrid'
import type { PublicationCard } from '@/blocks/LatestPublicationsBlock'
import { mergeContentOrder } from '@/lib/categoryContentOrder'
import { EventFilter } from './EventFilter'
import '../../styles.css'
import type { Payload } from 'payload'

type Params = { slug: string[] }

/** Максимум элементов, участвующих в ручной сортировке (чтобы не тянуть всё). */
const CONTENT_CAP = 500

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

export default async function CategoryPage({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { slug } = await params
  const sp = await searchParams
  // Фильтр/сортировка для разделов-событий.
  const evSort: 'new' | 'old' = String(sp?.sort || '') === 'old' ? 'old' : 'new'
  const evFrom = typeof sp?.from === 'string' ? sp.from : ''
  const evTo = typeof sp?.to === 'string' ? sp.to : ''
  // Пагинация списка: размер страницы 25/50/100 (дефолт 25) и номер страницы.
  const PER = [25, 50, 100]
  const per = PER.includes(Number(sp?.per)) ? Number(sp?.per) : 25
  const page = Math.max(1, Number(sp?.page) || 1)
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
  // (постерами 2:3). Публикации ветки тоже входят в общий список, но карточками
  // афиш. Для остальных обычных разделов — единый смешанный список.
  const isPosterContainer = Boolean(category.posterLayout)
  const isVideoSeries = Boolean(category.videoSeries)
  const isEvent = Boolean(category.eventTemplate)

  // Тип раздела «Страница»: рендерим одну привязанную публикацию как страницу
  // (например, профиль участника), без списка вложенных публикаций.
  if ((category as any).pageMode) {
    const bound = await payload.find({
      collection: 'publications',
      where: { and: [{ tenant: { equals: tenant.id } }, { category: { equals: category.id } }, publishedWhere()] },
      sort: '-publishedAt', depth: 2, limit: 1, overrideAccess: true,
    })
    const bpub: any = (bound.docs as any[])[0]
    const bcrumbs = (category.breadcrumbs ?? []) as { url?: string; label?: string }[]
    if (bpub && bpub.template === 'profile' && bpub.profile) {
      const cov = bpub.cover && typeof bpub.cover === 'object' ? bpub.cover : null
      const portraitUrl = cov?.sizes?.large?.url || cov?.url || null
      const pfGallery = Array.isArray(bpub.gallery)
        ? (bpub.gallery as any[]).map((row) => { const img = row?.image; const u = img && typeof img === 'object' ? (img.sizes?.thumbnail?.url || img.url) : null; return u ? { url: u as string, caption: row?.caption || '' } : null }).filter(Boolean)
        : []
      const pfVideos = Array.isArray(bpub.relatedVideos)
        ? (bpub.relatedVideos as any[]).map((v) => (v && typeof v === 'object' && v.slug ? { id: v.id, slug: String(v.slug), title: String(v.title || 'Видео'), coverUrl: videoThumbUrl(v) } : null)).filter(Boolean)
        : []
      const memberDocs = await payload.find({
        collection: 'publications',
        where: { and: [{ tenant: { equals: tenant.id } }, { template: { equals: 'profile' } }, { id: { not_equals: bpub.id } }, publishedWhere()] },
        sort: 'title', limit: 12, depth: 1, overrideAccess: true,
      })
      const members = (memberDocs.docs as any[]).map((m) => {
        const c = m.cover && typeof m.cover === 'object' ? (m.cover as any) : null
        return { slug: String(m.slug || ''), title: String(m.title || ''), portraitUrl: c?.sizes?.card?.url || c?.sizes?.large?.url || c?.url || null }
      }).filter((m: any) => m.slug)
      const categoryRows: Record<string, any> = {}
      const pblocks: any[] = Array.isArray((bpub.profile as any).blocks) ? (bpub.profile as any).blocks : []
      const catIds = Array.from(new Set(pblocks.filter((b) => b?.type === 'categoryRow' && b?.categoryId).map((b) => String(b.categoryId))))
      for (const cid of catIds) {
        const cat: any = /^\d+$/.test(cid)
          ? await payload.findByID({ collection: 'categories', id: cid, depth: 0, overrideAccess: true }).catch(() => null)
          : ((await payload.find({ collection: 'categories', where: { and: [{ tenant: { equals: tenant.id } }, { slug: { equals: cid } }] }, limit: 1, depth: 0, overrideAccess: true }).catch(() => ({ docs: [] as any[] }))).docs[0] || null)
        if (!cat || String(cat.tenant?.id ?? cat.tenant) !== String(tenant.id)) continue
        const rp = await payload.find({ collection: 'publications', where: { and: [{ tenant: { equals: tenant.id } }, { category: { equals: cat.id } }, publishedWhere()] }, sort: '-publishedAt', limit: 16, depth: 1, overrideAccess: true }).catch(() => ({ docs: [] as any[] }))
        const items = (rp.docs as any[]).map((p) => { const c = p.cover && typeof p.cover === 'object' ? p.cover : null; return { href: `/publication/${p.slug}`, title: String(p.title || ''), posterUrl: c?.sizes?.poster?.url || c?.sizes?.card?.url || c?.url || null } })
        if (items.length) categoryRows[cid] = { title: String(cat.title || ''), items }
      }
      const pubIds = Array.from(new Set(pblocks.filter((b) => b?.type === 'publications' && Array.isArray(b?.ids)).flatMap((b) => (b.ids as any[]).map((x) => String(x)))))
      const pubById: Record<string, any> = {}
      if (pubIds.length) {
        const fp = await payload.find({ collection: 'publications', where: { and: [{ tenant: { equals: tenant.id } }, { id: { in: pubIds } }, publishedWhere()] }, depth: 1, limit: 100, overrideAccess: true }).catch(() => ({ docs: [] as any[] }))
        for (const p of fp.docs as any[]) { const c = p.cover && typeof p.cover === 'object' ? p.cover : null; pubById[String(p.id)] = { href: `/publication/${p.slug}`, title: String(p.title || ''), posterUrl: c?.sizes?.poster?.url || c?.sizes?.card?.url || c?.url || null } }
      }
      return (
        <main className="page-canvas" style={{ ...brandVars(settings), minHeight: '100vh' }}>
          <div className="max-w-6xl mx-auto px-4 py-8">
            <Breadcrumbs crumbs={bcrumbs as any} lastIsCurrent className="mb-6" />
            <ProfileView data={bpub.profile} title={bpub.title} portraitUrl={portraitUrl} gallery={pfGallery as any} videos={pfVideos as any} members={members} categoryRows={categoryRows} pubById={pubById} />
          </div>
        </main>
      )
    }
    return (
      <main className="page-canvas" style={{ ...brandVars(settings), minHeight: '100vh' }}>
        <div className="max-w-6xl mx-auto px-4 py-8">
          <Breadcrumbs crumbs={bcrumbs as any} lastIsCurrent className="mb-6" />
          <h1 className="text-3xl lg:text-5xl font-extrabold" style={{ color: 'var(--brand-text)' }}>{category.title}</h1>
          <p style={{ color: 'var(--brand-muted)', marginTop: 16 }}>Для раздела-«страницы» пока нет привязанной публикации. Создайте публикацию с основной категорией «{category.title}».</p>
        </div>
      </main>
    )
  }

  // ── Видео-плейлист (сезоны/эпизоды) и одиночные видео-карточки ──────────────
  // Эпизоды — видео, назначенные прямо этой категории. Для контейнера афиш не
  // показываем (там дети — афиши). Ручная сортировка видео не затрагивает —
  // задача про подкатегории и публикации.
  let seriesEpisodes: SeriesEpisode[] = []
  if (!isPosterContainer) {
    const vidsRes = await payload.find({
      collection: 'videos',
      where: { and: [{ tenant: { equals: tenant.id } }, { category: { equals: category.id } }, { or: [{ embedStatus: { not_equals: 'unavailable' } }, { embedStatus: { exists: false } }] }] },
      sort: 'episode',
      depth: 1,
      limit: 500,
      overrideAccess: true,
    })
    seriesEpisodes = (vidsRes.docs as any[]).map((v) => {
      const coverUrl = videoThumbUrl(v)
      return {
        id: v.id,
        title: v.title || 'Без названия',
        slug: v.slug || '',
        coverUrl,
        previewGif: videoGifUrl(v),
        season: v.season ?? null,
        episode: v.episode ?? null,
        durationSec: v.durationSec ?? null,
        // Своё видео (self) без уровня — платное (замок), бесплатно только «превью».
        isFree: Boolean(v.isPreview) || (v.provider !== 'self' && !v.minTier),
        minTierName:
          v.minTier && typeof v.minTier === 'object' ? v.minTier.name || v.minTier.slug || null : null,
      }
    })
  }

  // ── Единый смешанный список: подкатегории + публикации в ручном порядке ─────
  // Применяется ко всем типам со списком (обычный, контейнер афиш, события).
  // Плейлист/страница обрабатываются выше и сюда не доходят.
  const applyManualOrder = !isVideoSeries

  // Прямые подкатегории (дефолтный порядок — по 'order').
  const childrenRes = await payload.find({
    collection: 'categories',
    where: { and: [{ tenant: { equals: tenant.id } }, { parent: { equals: category.id } }] },
    sort: 'order',
    limit: CONTENT_CAP,
    depth: 1,
    overrideAccess: true,
  })
  const children = childrenRes.docs as any[]

  // Публикации раздела: основная ИЛИ дополнительная категория. Витрина «Новинки»
  // (slug 'new') добавляет все активные «новинки». События — фильтр по диапазону.
  const catMatch: any[] = [
    { category: { in: [category.id] } },
    { extraCategories: { in: [category.id] } },
  ]
  if (category.slug === 'new') {
    catMatch.push({
      and: [
        { isNew: { equals: true } },
        { newUntil: { greater_than: new Date().toISOString() } },
      ],
    })
  }
  const eventRange: any[] = []
  if (isEvent && evFrom) eventRange.push({ eventDate: { greater_than_equal: evFrom } })
  if (isEvent && evTo) eventRange.push({ eventDate: { less_than_equal: `${evTo}T23:59:59.999` } })

  const pubsRes = applyManualOrder
    ? await payload.find({
        collection: 'publications',
        where: {
          and: [
            { tenant: { equals: tenant.id } },
            publishedWhere(),
            // Публикации участников (author-подписчик) — только в ленте сообщества,
            // в разделах редакции не показываются.
            { author: { exists: false } },
            { or: catMatch },
            ...eventRange,
          ],
        },
        sort: isEvent ? (evSort === 'old' ? 'eventDate' : '-eventDate') : '-publishedAt',
        depth: 1,
        limit: CONTENT_CAP,
        overrideAccess: true,
      })
    : { docs: [] as any[] }
  const pubsAll = pubsRes.docs as any[]

  // События с активным фильтром/сортировкой по дате — это явный выбор зрителя,
  // ручной порядок в этом случае уступает дате (иначе фильтр «не работает»).
  const eventDateOverride = isEvent && (evSort === 'old' || !!evFrom || !!evTo)
  const useManual = applyManualOrder && !eventDateOverride

  const catById = new Map<number, any>(children.map((c) => [Number(c.id), c]))
  const pubById = new Map<number, any>(pubsAll.map((p) => [Number(p.id), p]))

  const orderRefs = mergeContentOrder({
    order: useManual ? category.contentOrder : [],
    catIds: children.map((c) => c.id),
    pubIds: pubsAll.map((p) => p.id),
  })

  // Пагинация — по объединённому списку. Контейнер афиш показываем целиком
  // (как и раньше), без разбивки на страницы.
  const paginate = !isPosterContainer
  const totalItems = orderRefs.length
  const totalPages = paginate ? Math.max(1, Math.ceil(totalItems / per)) : 1
  const visibleRefs = paginate ? orderRefs.slice((page - 1) * per, page * per) : orderRefs

  // Счётчики комментариев/реакций — только для видимых публикаций.
  const visiblePubIds = visibleRefs.filter((r) => r.k === 'p').map((r) => r.id)
  const cardStats = applyManualOrder
    ? await getPublicationCardStats(visiblePubIds, tenant.id as number)
    : new Map<string, { comments: number; reactions: number }>()

  const crumbs = (category.breadcrumbs ?? []) as { url?: string; label?: string }[]

  // Обложка категории — фолбэк-превью для серий без собственной обложки.
  const seriesCoverRaw =
    (category as any).cover && typeof (category as any).cover === 'object' ? (category as any).cover : null
  const seriesCoverUrl =
    seriesCoverRaw?.sizes?.card?.url || seriesCoverRaw?.sizes?.thumb?.url || seriesCoverRaw?.url || null

  // Маппинг ссылки → карточка единой сетки (обычный/событийный раздел).
  const pubToCard = (p: any): PublicationCard => {
    const stats = cardStats.get(String(p.id))
    return {
      id: p.id,
      slug: p.slug,
      title: p.title,
      publishedAt: p.publishedAt,
      minTierName: p.minTier && typeof p.minTier === 'object' ? p.minTier.name || p.minTier.slug || null : null,
      cover: p.cover,
      eventDate: isEvent ? (p.eventDate ?? null) : null,
      commentCount: stats?.comments ?? 0,
      reactionCount: stats?.reactions ?? 0,
      hasVideo: Array.isArray(p.relatedVideos) && p.relatedVideos.length > 0,
      hasGallery: Array.isArray(p.gallery) && p.gallery.length > 0,
    }
  }
  const gridItems: CategoryContentItem[] = visibleRefs
    .map((ref): CategoryContentItem | null => {
      if (ref.k === 'c') {
        const c = catById.get(ref.id)
        if (!c) return null
        const cov = c.cover && typeof c.cover === 'object' ? c.cover : null
        return {
          kind: 'category',
          cat: {
            id: c.id,
            title: c.title,
            href: categoryHref(c),
            coverUrl: cov?.sizes?.card?.url || cov?.url || null,
            coverAlt: cov?.alt || null,
          },
        }
      }
      const p = pubById.get(ref.id)
      if (!p) return null
      return { kind: 'publication', pub: pubToCard(p) }
    })
    .filter((x): x is CategoryContentItem => x !== null)

  const emptyText = evFrom || evTo ? 'По заданным датам ничего не найдено.' : 'В этой категории пока нет материалов.'

  return (
    <main className="page-canvas" style={{ ...brandVars(settings), minHeight: '100vh' }}>
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Хлебные крошки */}
        <Breadcrumbs crumbs={crumbs as any} lastIsCurrent className="mb-6" />

        <div className="evhead">
          <h1 className="text-3xl lg:text-5xl font-extrabold" style={{ color: 'var(--brand-text)' }}>
            {category.title}
          </h1>
          {isEvent && (
            <EventFilter sort={evSort} from={evFrom} to={evTo} />
          )}
        </div>

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
          <>
            <VpnVideoNotice />
            <VideoSeriesBlock episodes={seriesEpisodes} seriesCoverUrl={seriesCoverUrl} />
          </>
        ) : (
          <>
            {/* Одиночные видео раздела — горизонтальными карточками над списком
                (не для контейнера афиш). */}
            {!isPosterContainer && seriesEpisodes.length > 0 && (
              <>
                <VpnVideoNotice />
                <VideoCardsBlock episodes={seriesEpisodes} />
              </>
            )}

            {isPosterContainer ? (
              // Контейнер: единая сетка афиш — подкатегории и публикации 2:3
              // в ручном порядке. Клик ведёт в раздел/публикацию.
              visibleRefs.length > 0 ? (
                <div className="poster-grid">
                  {visibleRefs.map((ref) => {
                    if (ref.k === 'c') {
                      const c = catById.get(ref.id)
                      if (!c) return null
                      const cover = c.cover && typeof c.cover === 'object' ? c.cover : null
                      const posterUrl = cover?.sizes?.poster?.url || cover?.url || null
                      return (
                        <a key={`c-${c.id}`} href={categoryHref(c)} className="poster-card" title={c.title}>
                          <div className="poster-card__frame">
                            {posterUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={posterUrl} alt={c.title} loading="lazy" className="poster-card__img" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
                            ) : (
                              <div className="poster-card__placeholder" aria-hidden>
                                {(c.title || '?').slice(0, 1).toUpperCase()}
                              </div>
                            )}
                          </div>
                        </a>
                      )
                    }
                    const p = pubById.get(ref.id)
                    if (!p) return null
                    const cover = p.cover && typeof p.cover === 'object' ? p.cover : null
                    const posterUrl = cover?.sizes?.poster?.url || cover?.sizes?.card?.url || cover?.url || null
                    return (
                      <a key={`p-${p.id}`} href={`/publication/${p.slug}`} className="poster-card" title={p.title}>
                        <div className="poster-card__frame">
                          {posterUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={posterUrl} alt={p.title} loading="lazy" className="poster-card__img" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
                          ) : (
                            <div className="poster-card__placeholder" aria-hidden>
                              {(p.title || '?').slice(0, 1).toUpperCase()}
                            </div>
                          )}
                        </div>
                      </a>
                    )
                  })}
                </div>
              ) : category.description ? null : (
                <p style={{ color: 'var(--brand-muted)' }}>В этом разделе пока нет материалов.</p>
              )
            ) : visibleRefs.length > 0 ? (
              <>
                <CategoryContentGrid items={gridItems} />
                {paginate && totalPages > 1 && (
                  <ListPagination
                    page={page}
                    totalPages={totalPages}
                    per={per}
                    total={totalItems}
                    basePath={`/category/${(Array.isArray(slug) ? slug : [slug]).join('/')}`}
                    query={{ sort: isEvent && evSort === 'old' ? 'old' : undefined, from: evFrom || undefined, to: evTo || undefined }}
                  />
                )}
              </>
            ) : category.description || seriesEpisodes.length > 0 ? null : (
              <p style={{ color: 'var(--brand-muted)' }}>{emptyText}</p>
            )}
          </>
        )}
      </div>
    </main>
  )
}
