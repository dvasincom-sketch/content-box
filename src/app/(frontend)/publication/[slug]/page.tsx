import Image from 'next/image'
import Link from 'next/link'
import { categoryHref } from '@/lib/categoryHref'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { notFound } from 'next/navigation'
import { RichText } from '@payloadcms/richtext-lexical/react'
import { getTenantFromHeaders } from '@/lib/tenant'
import { brandVars } from '@/lib/brand'
import { buildMetadata } from '@/lib/seo'
import { checkPublicationAccess } from '@/lib/publicationAccess'
import { checkVideoAccess } from '@/lib/videoAccess'
import { VideoPlayer } from '../../video/[slug]/VideoPlayer'
import { PublicGallery, type PublicGalleryItem } from './PublicGallery'
import { PostNavBlock, type PostNavItem } from '@/blocks/PostNavBlock'
import { Lock } from 'lucide-react'
import type { Metadata } from 'next'
import '../../styles.css'

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
  if (!pub) return {}

  const category = pub.category && typeof pub.category === 'object' ? pub.category : null

  return buildMetadata({
    defaults: (settings as any)?.seoDefaults,
    levels: [category?.seo, pub.seo],
    fallbackTitle: pub.title,
    brandName: (tenant as any)?.name,
  })
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
  payload: any,
  tenantId: number | string,
  currentPublishedAt: string,
  direction: 'prev' | 'next',
): Promise<any | null> {
  const res = await payload.find({
    collection: 'publications',
    where: {
      and: [
        { tenant: { equals: tenantId } },
        { publishedAt: { exists: true } },
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
  payload: any,
  tenantId: number | string,
  excludeId: number | string,
): Promise<any | null> {
  const where = {
    and: [
      { tenant: { equals: tenantId } },
      { publishedAt: { exists: true } },
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

  const category = pub.category && typeof pub.category === 'object' ? pub.category : null
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
          const access = await checkVideoAccess({ id })
          return { video: access.video || v, allowed: access.allowed, access }
        }),
      )
    : []

  // Галерея: доступна только если публикация открыта (наследует её minTier).
  // depth:2 → gallery.image populate'ится объектом с url/width/height.
  const galleryItems: PublicGalleryItem[] = pubAccess.allowed && Array.isArray(pub.gallery)
    ? pub.gallery
        .map((row: any) => {
          const img = row?.image
          if (!img || typeof img !== 'object' || !img.url) return null
          return {
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

  return (
    <main style={{ ...brandVars(settings?.theme), background: 'var(--brand-bg)', minHeight: '100vh' }}>
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Хлебные крошки: путь до категории (сам пост не дублируем — он в H1).
            Одна строка, горизонтальный скролл на мобиле, приглушённая плашка. */}
        <nav
          className="breadcrumbs mb-5 flex items-center gap-x-1.5 text-sm rounded-xl px-3 py-2"
          style={{
            color: 'var(--brand-text)',
            background: 'color-mix(in srgb, var(--brand-text) 6%, transparent)',
          }}
          aria-label="Хлебные крошки"
        >
          <Link href="/" className="whitespace-nowrap shrink-0 hover:opacity-100" style={{ opacity: 0.7 }}>
            Главная
          </Link>
          {((category?.breadcrumbs ?? []) as { url?: string; label?: string }[]).map((crumb, i) => (
            <span key={crumb.url ?? i} className="flex items-center gap-x-1.5 shrink-0">
              <span aria-hidden="true" style={{ opacity: 0.4 }}>›</span>
              <Link
                href={`/category${crumb.url}`}
                className="whitespace-nowrap hover:opacity-100"
                style={{ opacity: 0.7 }}
              >
                {crumb.label}
              </Link>
            </span>
          ))}
        </nav>

        {/* Журнальный герой: обложка (или брендовый градиент) + мета/заголовок
            поверх, белым по тёмному градиенту снизу. */}
        <div
          className="relative rounded-3xl overflow-hidden h-72 lg:h-96 flex flex-col justify-end"
          style={{ background: 'linear-gradient(135deg, var(--brand-primary), var(--brand-accent))' }}
        >
          {pub.cover && typeof pub.cover === 'object' && pub.cover.url && (
            <Image
              src={pub.cover.url}
              alt={pub.cover.alt || pub.title}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 768px"
              priority
            />
          )}
          {/* Тёмный градиент: плотный снизу, поднят до ~78% — перекрывает
              светлые зоны фото под заголовком (приоритет читаемости). */}
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.78) 28%, rgba(0,0,0,0.4) 55%, transparent 78%)',
            }}
          />
          {/* Только заголовок, прижат к низу обложки */}
          <div className="relative px-6 lg:px-10 pt-8 pb-14 lg:pb-20">
            <h1
              className="text-xl sm:text-3xl lg:text-5xl font-extrabold leading-tight"
              style={{
                color: '#fff',
                textShadow: '0 2px 14px rgba(0,0,0,0.6), 0 1px 3px rgba(0,0,0,0.9)',
              }}
            >
              {pub.title}
            </h1>
          </div>
        </div>

        {/* Контент-карточка: выразительный наезд на низ обложки (без JS) */}
        <div
          className="relative z-10 rounded-3xl px-5 lg:px-8 pt-6 pb-2"
          style={{
            marginTop: '-40px',
            background: 'var(--brand-bg)',
            boxShadow: '0 -8px 24px rgba(0,0,0,0.12)',
          }}
        >
          {/* Мета: категория-чип + дата — под обложкой, брендовыми цветами */}
          <div className="flex items-center flex-wrap gap-3 mb-6 text-sm">
            {category && (
              <Link
                href={categoryHref(category)}
                className="px-3 py-1 rounded-full font-medium"
                style={{
                  background: 'color-mix(in srgb, var(--brand-primary) 18%, transparent)',
                  color: 'var(--brand-text)',
                }}
              >
                {category.title}
              </Link>
            )}
            {dateStr && (
              <span style={{ color: 'var(--brand-text)', opacity: 0.6 }}>{dateStr}</span>
            )}
          </div>


        {pubAccess.allowed ? (
          <>
            {/* Прикреплённые видео — до описания, каждое со своим гейтингом */}
            {relatedVideos.length > 0 && (
              <div className="flex flex-col gap-6 mb-8">
                {relatedVideos.map(({ video, allowed, access }, i) => (
                  <div key={video?.id ?? i}>
                    {video?.title && (
                      <div className="text-lg font-semibold mb-2" style={{ color: 'var(--brand-text)' }}>{video.title}</div>
                    )}
                    {allowed ? (
                      <VideoPlayer videoId={video.id} />
                    ) : (
                      <VideoLockInline
                        reason={(access as any).reason}
                        requiredTierName={(access as any).requiredTierName}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}

            {pub.description && (
              <div className="prose-invert max-w-none mb-8 leading-relaxed" style={{ color: 'var(--brand-text)', opacity: 0.9 }}>
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
          <PublicationLock reason={pubAccess.reason} requiredTierName={pubAccess.requiredTierName} />
        )}

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
}: {
  reason: 'need-login' | 'need-subscription' | 'expired' | 'blocked'
  requiredTierName: string | null
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
    <div className="rounded-2xl p-8 lg:p-12 text-center"
      style={{ background: 'color-mix(in srgb, var(--brand-primary) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--brand-primary) 30%, transparent)' }}>
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-4"
        style={{ background: 'color-mix(in srgb, var(--brand-primary) 25%, transparent)' }}>
        <Lock size={24} style={{ color: 'var(--brand-text)' }} />
      </div>
      <div className="text-2xl font-bold mb-2" style={{ color: 'var(--brand-text)' }}>{heading}</div>
      <p className="mb-6 text-sm max-w-md mx-auto" style={{ color: 'var(--brand-text)', opacity: 0.75 }}>{text}</p>
      {reason !== 'blocked' && (
        <Link href="/subscribe" className="inline-block text-sm font-semibold px-6 py-3 rounded-xl transition-transform hover:-translate-y-0.5"
          style={{ background: 'var(--brand-primary)', color: '#fff' }}>
          {reason === 'expired' ? 'Продлить подписку' : reason === 'need-login' ? 'Войти или подписаться' : 'Оформить подписку'}
        </Link>
      )}
    </div>
  )
}

/* Компактный замок для закрытого прикреплённого видео внутри открытой публикации */
function VideoLockInline({
  reason,
  requiredTierName,
}: {
  reason: string
  requiredTierName?: string | null
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
        <p className="mb-4 text-sm max-w-xs mx-auto" style={{ color: '#fff', opacity: 0.92 }}>{text}</p>
        <Link href="/subscribe" className="inline-block text-sm font-semibold px-5 py-2.5 rounded-xl"
          style={{ background: '#fff', color: 'var(--brand-primary)' }}>
          Оформить подписку
        </Link>
      </div>
    </div>
  )
}
