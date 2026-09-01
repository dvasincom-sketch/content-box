import Image from 'next/image'
import Link from 'next/link'
import { categoryHref } from '@/lib/categoryHref'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { notFound } from 'next/navigation'
import { RichText } from '@payloadcms/richtext-lexical/react'
import { getTenantFromHeaders } from '@/lib/tenant'
import { brandVars } from '@/lib/brand'
import { getCurrentSubscriber } from '@/lib/currentSubscriber'
import { isPublished, publishedWhere } from '@/lib/published'
import { BookmarkButton } from '@/components/social/BookmarkButton'
import { ViewTracker } from '@/components/social/ViewTracker'
import { buildMetadata } from '@/lib/seo'
import { checkPublicationAccess } from '@/lib/publicationAccess'
import { checkVideoAccess } from '@/lib/videoAccess'
import { VideoPlayer } from '../../video/[slug]/VideoPlayer'
import { AsyaSummary } from '../../video/[slug]/AsyaSummary'
import { ASYA_MIN_TIER_PRICE } from '@/lib/asya'
import { VpnVideoNotice } from '@/components/VpnVideoNotice'
import { PublicGallery, type PublicGalleryItem } from './PublicGallery'
import { ProfileView } from './ProfileView'
import { videoThumbUrl, videoGifUrl } from '@/lib/videoThumb'
import { VideoSeriesBlock, type SeriesEpisode } from '@/blocks/VideoSeriesBlock'
import { PostNavBlock, type PostNavItem } from '@/blocks/PostNavBlock'
import { CrossLinkCard, breadcrumbLabelPath } from '@/components/CrossLinkCard'
import { TagChips } from '@/components/TagChips'
import { LatestPublicationsBlock } from '@/blocks/LatestPublicationsBlock'
import { getPublicationCardStats } from '@/lib/publicationCardStats'
import { PublicationEngagement } from './PublicationEngagement'
import { getPublicationEngagement } from '@/lib/publicationEngagement'
import { Lock } from 'lucide-react'
import type { Metadata } from 'next'
import '../../styles.css'
import type { Payload } from 'payload'

type Params = { slug: string }

/**
 * SEO-каскад (ТЗ §6): дефолт тенанта → категория → публикация.
 */
export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params
  const ctx = await getTenantFromHeaders()
  if (!ctx) return {}
  const { tenant, settings } = ctx

  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })
  const res = await payload.find({
    collection: 'publications',
    where: { and: [{ tenant: { equals: tenant.id } }, { slug: { equals: slug } }] },
    limit: 1,
    depth: 2,
    overrideAccess: true,
  })

  const pub = res.docs[0] as any
  if (!pub || !isPublished(pub)) notFound()

  const category = pub.category && typeof pub.category === 'object' ? pub.category : null

  return buildMetadata({
    defaults: settings?.seoDefaults,
    levels: [category?.seo, pub.seo],
    fallbackTitle: pub.title,
    brandName: tenant.name,
  })
}

/** Есть ли осмысленный текст в lexical-richtext (для «видео-центричного» шаблона #2). */
function lexicalHasText(rt: unknown): boolean {
  let len = 0
  const walk = (node: any) => {
    if (!node || len > 0) return
    if (typeof node.text === 'string') len += node.text.trim().length
    if (Array.isArray(node.children)) node.children.forEach(walk)
  }
  const root = (rt as { root?: { children?: unknown[] } } | null)?.root
  if (root?.children && Array.isArray(root.children)) root.children.forEach(walk)
  return len > 0
}

/** Публикация → карточка навигации. minTier задан → premium (бейдж). */
function toNavItem(doc: any, kind: PostNavItem['kind']): PostNavItem {
  const category = doc?.category && typeof doc.category === 'object' ? doc.category : null
  const cover = doc?.cover && typeof doc.cover === 'object' ? doc.cover : null
  return {
    title: doc?.title ?? '',
    href: `/publication/${doc?.slug}`,
    categoryTitle: category?.title ?? null,
    coverUrl: cover?.url ?? null,
    isPremium: doc?.minTier != null && doc.minTier !== '',
    kind,
  }
}

/**
 * Ближайший сосед по дате. direction 'prev' — более ранний (publishedAt <),
 * 'next' — более поздний (publishedAt >). Учитываем только посты с датой.
 */
async function findNeighbor(
  payload: Payload,
  tenantId: number | string,
  currentPublishedAt: string,
  direction: 'prev' | 'next',
): Promise<any | null> {
  const res = await payload.find({
    collection: 'publications',
    where: {
      and: [
        { tenant: { equals: tenantId } },
        publishedWhere(),
        direction === 'prev'
          ? { publishedAt: { less_than: currentPublishedAt } }
          : { publishedAt: { greater_than: currentPublishedAt } },
      ],
    },
    sort: direction === 'prev' ? '-publishedAt' : 'publishedAt',
    limit: 1,
    depth: 1,
    overrideAccess: true,
  })
  return res.docs[0] || null
}

/** Случайная публикация тенанта (исключая текущую) — фолбэк на краю ленты. */
async function findRandom(
  payload: Payload,
  tenantId: number | string,
  excludeId: number | string,
): Promise<any | null> {
  const where = {
    and: [
      { tenant: { equals: tenantId } },
      publishedWhere(),
      { id: { not_equals: excludeId } },
    ],
  }
  const countRes = await payload.find({
    collection: 'publications',
    where,
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const total = countRes.totalDocs || 0
  if (total === 0) return null
  const randomPage = Math.floor(Math.random() * total) + 1
  const res = await payload.find({
    collection: 'publications',
    where,
    limit: 1,
    page: randomPage,
    depth: 1,
    overrideAccess: true,
  })
  return res.docs[0] || null
}

export default async function PublicationPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params

  const ctx = await getTenantFromHeaders()
  if (!ctx) return <div className="p-8">Тенант не определён.</div>
  const { tenant, settings } = ctx

  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })

  const res = await payload.find({
    collection: 'publications',
    where: { and: [{ tenant: { equals: tenant.id } }, { slug: { equals: slug } }] },
    limit: 1, depth: 2, overrideAccess: true,
  })
  const pub = res.docs[0] as any
  if (!pub) notFound()
  // Черновик по прямой ссылке публично не открываем: страница не фильтровала
  // publishedAt вовсе, поэтому неопубликованный материал читался целиком, если
  // угадать slug (а он предсказуем — генерируется из заголовка).
  if (!isPublished(pub)) notFound()

  const viewer = await getCurrentSubscriber().catch(() => null)
  let bookmarked = false
  if (viewer && tenant?.id) {
    const bm = await payload.find({
      collection: 'bookmarks',
      where: { and: [{ subscriber: { equals: viewer.id } }, { tenant: { equals: tenant.id } }, { publication: { equals: pub.id } }] },
      limit: 1, depth: 0, overrideAccess: true,
    })
    bookmarked = bm.docs.length > 0
  }

  const category = pub.category && typeof pub.category === 'object' ? pub.category : null
  // Связка со «Смотреть» (depth:2 populate'ит объект с breadcrumbs для ссылки).
  const watchCat =
    pub.watchCategory && typeof pub.watchCategory === 'object' ? pub.watchCategory : null
  const eventStr = pub.eventDate
    ? new Date(pub.eventDate).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Moscow' })
    : null
  const dateStr = pub.publishedAt
    ? new Date(pub.publishedAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
    : null

  // Гейтинг публикации: если minTier задан и нет доступа — вся публикация под замком
  const pubAccess = await checkPublicationAccess(pub)

  // Прикреплённые видео: для каждого проверяем доступ отдельно (по его minTier)
  const relatedRaw = Array.isArray(pub.relatedVideos) ? pub.relatedVideos : []
  const relatedVideos = pubAccess.allowed
    ? await Promise.all(
        relatedRaw.map(async (v: any) => {
          const id = v && typeof v === 'object' ? v.id : v
          const access = await checkVideoAccess({ id, tenantId: tenant.id })
          return { video: access.video || v, allowed: access.allowed, access }
        }),
      )
    : []

  // Плейлист: если прикреплено больше одного медиа (видео/аудио) — показываем их
  // как единый плейлист (тот же формат, что в категории-серии), а не стопкой
  // отдельных плееров. Порядок сохраняем как у прикреплённых (episode ← индекс,
  // если у видео нет своего номера серии).
  const pubCoverForSeries = pub.cover && typeof pub.cover === 'object'
    ? ((pub.cover as any).sizes?.card?.url || (pub.cover as any).url || null)
    : null
  const relatedEpisodes: SeriesEpisode[] = relatedVideos.map(({ video: v }, i) => ({
    id: v.id,
    title: v.title || 'Без названия',
    slug: v.slug || '',
    coverUrl: videoThumbUrl(v),
    previewGif: videoGifUrl(v),
    season: v.season ?? null,
    episode: v.episode ?? i + 1,
    durationSec: v.durationSec ?? null,
    // Своё видео (self) без уровня — платное (замок), бесплатно только «превью».
    // Внешняя вставка (embed) без уровня — бесплатна.
    isFree: Boolean(v.isPreview) || (v.provider !== 'self' && !v.minTier),
    minTierName: v.minTier && typeof v.minTier === 'object' ? v.minTier.name || v.minTier.slug || null : null,
  }))

  // #2: «видео-центричный» шаблон — обложка+заголовок+видео без текстового тела.
  // Скрываем отдельную большую обложку сверху (постер плеера её дублирует).
  const isVideoFirst = pubAccess.allowed && !lexicalHasText(pub.description) && relatedVideos.length > 0

  // Галерея: доступна только если публикация открыта (наследует её minTier).
  // depth:2 → gallery.image populate'ится объектом с url/width/height/sizes.
  // На сайт отдаём НЕ оригинал (8–10 МБ), а сгенерированные размеры (WebP):
  // thumbnail в сетку, large в лайтбокс. url — фолбэк, если размеров нет.
  const galleryItems: PublicGalleryItem[] = pubAccess.allowed && Array.isArray(pub.gallery)
    ? pub.gallery
        .map((row: any) => {
          const img = row?.image
          if (!img || typeof img !== 'object' || !img.url) return null
          const sizes = img.sizes || {}
          const thumbUrl = sizes.thumbnail?.url || img.url
          const largeUrl = sizes.large?.url || img.url
          return {
            thumbUrl: thumbUrl as string,
            largeUrl: largeUrl as string,
            url: img.url as string,
            width: img.width || null,
            height: img.height || null,
            caption: row?.caption || '',
            alt: img.alt || row?.caption || '',
          }
        })
        .filter((x: any): x is PublicGalleryItem => x != null)
    : []

  // Навигация между публикациями (внизу поста). Соседи по publishedAt; на краю
  // ленты — случайный пост (подпись «Читайте также»). Только посты с датой.
  let navPrev: PostNavItem | null = null
  let navNext: PostNavItem | null = null
  if (pub.publishedAt) {
    const [prevDoc, nextDoc] = await Promise.all([
      findNeighbor(payload, tenant.id, pub.publishedAt, 'prev'),
      findNeighbor(payload, tenant.id, pub.publishedAt, 'next'),
    ])
    navPrev = prevDoc ? toNavItem(prevDoc, 'prev') : null
    navNext = nextDoc ? toNavItem(nextDoc, 'next') : null

    // Край ленты: недостающую сторону заполняем случайным постом.
    if (!prevDoc) {
      const rnd = await findRandom(payload, tenant.id, pub.id)
      if (rnd) navPrev = toNavItem(rnd, 'related')
    }
    if (!nextDoc) {
      const rnd = await findRandom(payload, tenant.id, pub.id)
      if (rnd) navNext = toNavItem(rnd, 'related')
    }
  }

  // Данные реакций и комментариев — серверная выборка (Comments/Reactions),
  // текущий подписчик и агрегация внутри хелпера. Пусто-устойчиво.
  const engagement = await getPublicationEngagement(pub.id, tenant.id)

  // Теги публикации + подборка «похожие по тегам» (любой общий тег).
  const tagList = (Array.isArray(pub.tags) ? pub.tags : [])
    .filter((t: any) => t?.slug && t?.label)
    .map((t: any) => ({ label: String(t.label), slug: String(t.slug) }))
  let relatedByTags: any[] = []
  let relatedStats = new Map<string, { comments: number; reactions: number }>()
  if (tagList.length) {
    const rt = await payload.find({
      collection: 'publications',
      where: {
        and: [
          { tenant: { equals: tenant.id } },
          { 'tags.slug': { in: tagList.map((t: any) => t.slug) } },
          { id: { not_equals: pub.id } },
          publishedWhere(),
        ],
      },
      sort: '-publishedAt',
      limit: 6,
      depth: 1,
      overrideAccess: true,
    })
    relatedByTags = rt.docs as any[]
    relatedStats = await getPublicationCardStats(
      relatedByTags.map((p) => p.id),
      tenant.id as number,
    )
  }


  // Шаблон «Профиль» — страница-досье вместо обычной статьи.
  if (pub.template === 'profile' && pub.profile && typeof pub.profile === 'object') {
    const coverObj = pub.cover && typeof pub.cover === 'object' ? (pub.cover as any) : null
    const portraitUrl = coverObj?.sizes?.large?.url || coverObj?.url || null
    const pfGallery = galleryItems.map((g) => ({ url: g.thumbUrl || g.url, caption: g.caption }))
    const pfVideos = relatedVideos
      .map(({ video }: any) => ({ id: video?.id, slug: String(video?.slug || ''), title: String(video?.title || 'Видео'), coverUrl: videoThumbUrl(video) }))
      .filter((v: any) => v.slug)
    // Другие участники: остальные профили тенанта — для перелинковки внизу.
    const memberDocs = await payload.find({
      collection: 'publications',
      where: { and: [{ tenant: { equals: tenant.id } }, { template: { equals: 'profile' } }, { id: { not_equals: pub.id } }, publishedWhere()] },
      sort: 'title', limit: 12, depth: 1, overrideAccess: true,
    })
    const members = (memberDocs.docs as any[]).map((m) => {
      const c = m.cover && typeof m.cover === 'object' ? (m.cover as any) : null
      return { slug: String(m.slug || ''), title: String(m.title || ''), portraitUrl: c?.sizes?.card?.url || c?.sizes?.large?.url || c?.url || null }
    }).filter((m: any) => m.slug)
    // Ряды-постеры категорий, встроенные в профиль: резолвим публикации категории.
    const categoryRows: Record<string, any> = {}
    const pblocks: any[] = Array.isArray((pub.profile as any).blocks) ? (pub.profile as any).blocks : []
    // SEO-alt для блочных галерей: подтягиваем alt из библиотеки (gallery-images.alt)
    // в отдельное поле img.alt. Блоки в БД не переписываем — только для рендера.
    const galImgIds = Array.from(new Set(
      pblocks.filter((b) => b?.type === 'gallery' && Array.isArray(b?.images))
        .flatMap((b) => (b.images as any[]).map((im) => im?.imageId).filter((x) => x != null).map((x) => String(x))),
    ))
    if (galImgIds.length) {
      const gi = await payload.find({ collection: 'gallery-images', where: { id: { in: galImgIds } }, limit: 300, depth: 0, overrideAccess: true }).catch(() => ({ docs: [] as any[] }))
      const altMap = new Map<string, string>((gi.docs as any[]).map((d) => [String(d.id), String(d.alt || '')]))
      for (const b of pblocks) {
        if (b?.type !== 'gallery' || !Array.isArray(b.images)) continue
        for (const im of b.images) {
          if (im?.imageId != null) { const a = altMap.get(String(im.imageId)); if (a) im.alt = a }
        }
      }
    }
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
          <ProfileView data={pub.profile as any} title={pub.title} portraitUrl={portraitUrl} gallery={pfGallery} videos={pfVideos} members={members} categoryRows={categoryRows} pubById={pubById} />
        </div>
      </main>
    )
  }

  return (
    <main className="page-canvas" style={{ ...brandVars(settings), minHeight: '100vh' }}>
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Категория публикации показывается чипом ниже (в мете) — путь с
            родительскими разделами намеренно НЕ выводим: для публикаций это
            лишнее (правило для всех публикаций). */}
        {/* Обложка: только при наличии фото (Ken Burns). Нет обложки — блок не
            выводим вообще, без градиента-заглушки. Заголовок идёт ниже. */}
        {!isVideoFirst && !(category as { posterLayout?: boolean } | null)?.posterLayout && pub.cover && typeof pub.cover === 'object' && pub.cover.url && (
          <div className="pubhero-cover relative rounded-3xl overflow-hidden h-72 lg:h-96">
            <Image
              src={pub.cover.url}
              alt={pub.cover.alt || pub.title}
              fill
              className="pubhero-kenburns object-cover"
              sizes="(max-width: 768px) 100vw, 768px"
              priority
            />
          </div>
        )}

        {/* Заголовок — отдельной зоной под обложкой, брендовым цветом.
            Характер «тех-кампания»: шрифт тенанта (var(--font-heading)),
            полужирный вес 500 + плотный трекинг вместо тяжёлого bold. */}
        <h1
          className="pubhero-reveal pubhero-d2 text-3xl lg:text-5xl mt-7 mb-6"
          style={{
            color: 'var(--brand-text)',
            fontFamily: 'var(--font-heading)',
            fontWeight: 700,
            letterSpacing: '-0.02em',
            lineHeight: 1.08,
          }}
        >
          {pub.title}
        </h1>

        {pub.author && typeof pub.author === 'object' && (
          <div style={{ marginTop: -8, marginBottom: 8, color: 'var(--brand-muted)' }}>
            Автор:{' '}
            {pub.author.handle && !pub.author.profilePrivate && !pub.author.isBlocked ? (
              <Link href={`/u/${pub.author.handle}`} style={{ color: 'var(--brand-primary)' }}>
                {pub.author.displayName || `@${pub.author.handle}`}
              </Link>
            ) : (
              <span>{pub.author.displayName || 'Участник'}</span>
            )}
          </div>
        )}

        <ViewTracker targetType="publication" targetId={pub.id} />

        {/* Контент: мета + тело публикации (без журнального наезда). */}
        <div className="relative">
          {/* Мета: категория-чип + дата. Характер «тех-кампания»:
              чип — сдержанная пилюля-подложка (.pubmeta-chip),
              дата — с акцентной точкой-маркером (.pubmeta-date). */}
          <div className="pubhero-reveal pubhero-d3 flex items-center flex-wrap gap-3 mb-6" style={{ justifyContent: 'space-between' }}>
            <div className="flex items-center flex-wrap gap-3">
              {eventStr && (
                <span style={{ background: '#ea580c', color: '#fff', fontWeight: 700, padding: '4px 12px', borderRadius: 999, fontSize: '0.95rem', boxShadow: '0 2px 8px rgba(234,88,12,.35)' }}>
                  {eventStr}
                </span>
              )}
              {category && (
                <Link href={categoryHref(category)} className="pubmeta-chip">
                  {category.title}
                </Link>
              )}
              {dateStr && <span className="pubmeta-date">{dateStr}</span>}
            </div>
            {viewer && <BookmarkButton targetType="publication" targetId={pub.id} initialSaved={bookmarked} />}
          </div>

          {/* Связка со «Смотреть»: увести читателя органики в видеораздел по теме.
              Показываем всегда — даже если статья под замком, посмотреть можно. */}
          {watchCat && (
            <div className="mb-6">
              <CrossLinkCard
                href={categoryHref(watchCat)}
                variant="watch"
                title={watchCat.title}
                path={breadcrumbLabelPath(watchCat.breadcrumbs)}
              />
            </div>
          )}

        {pubAccess.allowed ? (
          <>
            {/* Больше одного медиа — единый плейлист (формат категории-серии). */}
            {relatedVideos.length > 1 && (
              <div className="mb-8">
                <VpnVideoNotice />
                <VideoSeriesBlock episodes={relatedEpisodes} seriesCoverUrl={pubCoverForSeries} />
              </div>
            )}

            {/* Одно прикреплённое видео — отдельный плеер со своим гейтингом и Асей */}
            {relatedVideos.length === 1 && (
              <div className="flex flex-col gap-6 mb-8">
                <VpnVideoNotice />
                {relatedVideos.map(({ video, allowed, access }, i) => (
                  <div
                    key={video?.id ?? i}
                    className="rounded-2xl p-4 lg:p-5"
                    style={{
                      background: 'var(--brand-surface)',
                      boxShadow: 'var(--brand-card-shadow)',
                    }}
                  >
                    {video?.title && (
                      <div className="text-lg font-semibold mb-3" style={{ color: 'var(--brand-text)' }}>{video.title}</div>
                    )}
                    {allowed ? (
                      video?.embedStatus === 'unavailable' ? (
                        <div
                          className="rounded-xl px-4 py-6 text-center"
                          style={{ background: 'color-mix(in srgb, var(--brand-text) 5%, transparent)', color: 'var(--brand-muted)', fontSize: '.92rem', lineHeight: 1.5 }}
                        >
                          Это видео сейчас недоступно у источника — возможно, оно удалено или ссылка изменилась. Мы уже знаем о проблеме.
                        </div>
                      ) : (
                        <VideoPlayer videoId={video.id} />
                      )
                    ) : (
                      <VideoLockInline
                        reason={(access as any).reason}
                        requiredTierName={(access as any).requiredTierName}
                        loginRedirect={`/publication/${slug}`}
                      />
                    )}
                    {/* Просмотр видео внутри публикации (в т.ч. VK-embed) — иначе
                        в аналитике «Зрителей» по видео всегда 0. */}
                    {allowed && <ViewTracker targetType="video" targetId={video.id} />}
                    {allowed && video?.provider === 'self' && ((Array.isArray(video.subtitles) && video.subtitles.length > 0) || video.summary) ? (
                      <div style={{ marginTop: 16 }}>
                        <AsyaSummary videoId={video.id} minPrice={ASYA_MIN_TIER_PRICE} />
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}

            {pub.description && (
              <div className="prose-invert max-w-none mb-8 leading-relaxed" style={{ color: 'var(--brand-text)' }}>
                <RichText data={pub.description} />
              </div>
            )}

            {galleryItems.length > 0 && (
              <section
                className="cgal-section"
                style={{
                  marginLeft: 'calc(50% - 50vw)',
                  marginRight: 'calc(50% - 50vw)',
                  width: '100vw',
                  marginTop: '2.5rem',
                }}
              >
                <div className="cgal-plate">
                  <h2 className="cgal-plate__title">Галерея</h2>
                  <PublicGallery items={galleryItems} />
                </div>
              </section>
            )}
          </>
        ) : (
          <PublicationLock reason={pubAccess.reason} requiredTierName={pubAccess.requiredTierName} loginRedirect={`/publication/${slug}`} />
        )}

        {tagList.length > 0 && (
          <div className="mt-8">
            <TagChips tags={tagList} />
          </div>
        )}

        {relatedByTags.length > 0 && (
          <div className="mt-12">
            <LatestPublicationsBlock
              heading="Похожие по тегам"
              items={relatedByTags.map((p) => {
                const s = relatedStats.get(String(p.id))
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
                  commentCount: s?.comments ?? 0,
                  reactionCount: s?.reactions ?? 0,
                  hasVideo: Array.isArray(p.relatedVideos) && p.relatedVideos.length > 0,
                  hasGallery: Array.isArray(p.gallery) && p.gallery.length > 0,
                }
              })}
            />
          </div>
        )}

        {/* Реакции + комментарии. Видны всегда (для гостя — тизер с приглашением). */}
        <PublicationEngagement
          isAuthed={engagement.isAuthed}
          canModerate={engagement.canModerate}
          publicationId={pub.id}
          publicationSlug={slug}
          currentUser={engagement.currentUser}
          reactions={engagement.reactions}
          comments={engagement.comments}
          commentCount={engagement.commentCount}
        />

        <PostNavBlock prev={navPrev} next={navNext} />
        </div>
      </div>
    </main>
  )
}

/* Замок всей публикации — тизер уже показан выше (заголовок, обложка) */
function PublicationLock({
  reason,
  requiredTierName,
  loginRedirect,
}: {
  reason: 'need-login' | 'need-subscription' | 'expired' | 'blocked'
  requiredTierName: string | null
  loginRedirect?: string
}) {
  const heading =
    reason === 'need-login' ? 'Войдите, чтобы читать'
    : reason === 'expired' ? 'Подписка истекла'
    : reason === 'blocked' ? 'Доступ ограничен'
    : 'Доступно по подписке'
  const text =
    reason === 'need-login' ? 'Эта публикация доступна подписчикам. Войдите или оформите подписку.'
    : reason === 'expired' ? 'Продлите подписку, чтобы снова открыть этот и весь премиум-материал.'
    : reason === 'blocked' ? 'Ваш аккаунт временно ограничен. Свяжитесь с поддержкой.'
    : requiredTierName ? `Публикация открыта на уровне «${requiredTierName}» и выше.`
    : 'Эта публикация доступна подписчикам.'

  return (
    <div className="relative rounded-2xl overflow-hidden flex flex-col items-center justify-center text-center px-6"
      style={{ background: 'linear-gradient(135deg, var(--brand-primary), var(--brand-accent))' }}>
      <div className="py-12 lg:py-16">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-4"
          style={{ background: 'rgba(0,0,0,.35)', backdropFilter: 'blur(6px)' }}>
          <Lock size={24} color="#fff" />
        </div>
        <div className="text-2xl font-bold mb-2" style={{ color: '#fff' }}>{heading}</div>
        <p className="text-sm max-w-md mx-auto" style={{ color: '#fff', opacity: 0.92, marginBottom: 28 }}>{text}</p>
        {reason !== 'blocked' && (
          <Link href="/subscribe" className="inline-block text-sm font-semibold px-5 py-2.5 rounded-xl"
            style={{ background: '#fff', color: 'var(--brand-primary)' }}>
            {reason === 'expired' ? 'Продлить подписку' : 'Оформить подписку'}
          </Link>
        )}
        {reason === 'need-login' && (
          <div style={{ marginTop: 12 }}>
            <Link href={`/login?redirect=${encodeURIComponent(loginRedirect || '/')}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#fff', opacity: 0.85, fontSize: 13.5, fontWeight: 600, textDecoration: 'underline', textUnderlineOffset: 4 }}>Есть подписка — войти →</Link>
          </div>
        )}
      </div>
    </div>
  )
}

/* Компактный замок для закрытого прикреплённого видео внутри открытой публикации */
function VideoLockInline({
  reason,
  requiredTierName,
  loginRedirect,
}: {
  reason: string
  requiredTierName?: string | null
  loginRedirect?: string
}) {
  const text =
    reason === 'need-login' ? 'Видео доступно подписчикам — войдите или оформите подписку.'
    : reason === 'expired' ? 'Подписка истекла — продлите, чтобы смотреть.'
    : requiredTierName ? `Видео открыто на уровне «${requiredTierName}» и выше.`
    : 'Видео доступно подписчикам.'
  return (
    <div className="relative rounded-2xl overflow-hidden flex flex-col items-center justify-center text-center px-6"
      style={{ paddingTop: '0', minHeight: '200px', background: 'linear-gradient(135deg, var(--brand-primary), var(--brand-accent))' }}>
      <div className="py-10">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full mb-3"
          style={{ background: 'rgba(0,0,0,.35)', backdropFilter: 'blur(6px)' }}>
          <Lock size={20} color="#fff" />
        </div>
        <p className="text-sm max-w-xs mx-auto" style={{ color: '#fff', opacity: 0.92, marginBottom: 28 }}>{text}</p>
        <Link href="/subscribe" className="inline-block text-sm font-semibold px-5 py-2.5 rounded-xl"
          style={{ background: '#fff', color: 'var(--brand-primary)' }}>
          Оформить подписку
        </Link>
        {reason === 'need-login' && (
          <div style={{ marginTop: 12 }}>
            <Link href={`/login?redirect=${encodeURIComponent(loginRedirect || '/')}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#fff', opacity: 0.85, fontSize: 13.5, fontWeight: 600, textDecoration: 'underline', textUnderlineOffset: 4 }}>Есть подписка — войти →</Link>
          </div>
        )}
      </div>
    </div>
  )
}
