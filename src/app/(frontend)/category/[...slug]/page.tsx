import { getPayload } from 'payload'
import config from '@/payload.config'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getTenantFromHeaders } from '@/lib/tenant'
import { brandVars } from '@/lib/brand'
import { buildMetadata } from '@/lib/seo'
import type { Metadata } from 'next'
import { LatestPublicationsBlock } from '@/blocks/LatestPublicationsBlock'
import { getPublicationCardStats } from '@/lib/publicationCardStats'
import { RichText } from '@/components/RichText'
import { CategoriesGridBlock } from '@/blocks/CategoriesGridBlock'
import { categoryHref } from '@/lib/categoryHref'
import '../../styles.css'

type Params = { slug: string[] }

/** Полный путь из сегментов: ['discography','chapter-1'] → '/discography/chapter-1' */
function toPath(segments: string[]): string {
  return '/' + segments.join('/')
}

/**
 * Категория по полному пути: спускаемся по сегментам от корня.
 * По одному запросу на сегмент (индекс slug + parent_id), точное совпадение.
 * Фильтр по breadcrumbs не годится: крошка `/videography` есть у всех потомков.
 */
async function findCategory(payload: any, tenantID: number, segments: string[]) {
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
  if (!category) return {}

  return buildMetadata({
    defaults: (settings as any)?.seoDefaults,
    levels: [category.seo],
    fallbackTitle: category.title,
    brandName: (tenant as any)?.name,
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

  // Публикации всей ветки: категории, у которых текущая есть в цепочке предков.
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

  const pubsRes = await payload.find({
    collection: 'publications',
    where: {
      and: [{ tenant: { equals: tenant.id } }, { category: { in: branchIDs } }],
    },
    sort: '-publishedAt',
    depth: 1,
    limit: 50,
    overrideAccess: true,
  })
  const pubs = pubsRes.docs as any[]

  // Счётчики комментариев и реакций для карточек — один агрегирующий запрос.
  const cardStats = await getPublicationCardStats(
    pubs.map((p) => p.id),
    tenant.id as number,
  )

  // Прямые подкатегории — плитками под публикациями.
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
    <main style={{ ...brandVars(settings?.theme), background: 'var(--brand-bg)', minHeight: '100vh' }}>
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Хлебные крошки */}
        <nav className="text-sm mb-6 flex flex-wrap items-center gap-x-2 gap-y-1"
          style={{ color: 'var(--brand-text)', opacity: 0.7 }}
          aria-label="Хлебные крошки">
          <Link href="/" className="hover:opacity-100">Главная</Link>
          {crumbs.map((crumb, i) => {
            const isLast = i === crumbs.length - 1
            return (
              <span key={crumb.url ?? i} className="flex items-center gap-x-2">
                <span aria-hidden="true">/</span>
                {isLast ? (
                  <span style={{ opacity: 1 }}>{crumb.label}</span>
                ) : (
                  <Link href={`/category${crumb.url}`} className="hover:opacity-100">
                    {crumb.label}
                  </Link>
                )}
              </span>
            )
          })}
        </nav>

        <h1 className="text-3xl lg:text-5xl font-extrabold mb-2" style={{ color: 'var(--brand-text)' }}>
          {category.title}
        </h1>

        {category.description ? (
          <div className="max-w-3xl mx-auto mb-12">
            <RichText data={category.description} />
          </div>
        ) : null}

        {pubs.length === 0 ? (
          // Если есть статья или подкатегории — раздел не пустой.
          category.description || children.length > 0 ? null : (
            <p style={{ color: 'var(--brand-text)', opacity: 0.7 }}>
              В этой категории пока нет публикаций.
            </p>
          )
        ) : category.posterLayout ? (
          // Киноблок: сетка вертикальных постеров 2:3 (весь список, без подписей).
          <div className="poster-grid">
            {pubs.map((p) => {
              const cover = p.cover && typeof p.cover === 'object' ? p.cover : null
              const posterUrl =
                cover?.sizes?.poster?.url || cover?.url || null
              return (
                <a
                  key={p.id}
                  href={`/publication/${p.slug}`}
                  className="poster-card"
                  title={p.title}
                >
                  <div className="poster-card__frame">
                    {posterUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={posterUrl}
                        alt={p.title}
                        loading="lazy"
                        className="poster-card__img"
                        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
                      />
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

        {/* Прямые подкатегории — плитками */}
        {children.length > 0 && (
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
