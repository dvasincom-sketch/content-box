import Link from 'next/link'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { videoThumbUrl, videoGifUrl } from '@/lib/videoThumb'
import { HoverPreviewImage } from '@/components/HoverPreviewImage'
import { notFound } from 'next/navigation'
import { getTenantFromHeaders } from '@/lib/tenant'
import { brandVars } from '@/lib/brand'
import { buildMetadata } from '@/lib/seo'
import { publishedWhere } from '@/lib/published'
import { LatestPublicationsBlock } from '@/blocks/LatestPublicationsBlock'
import { ListPagination } from '@/components/ListPagination'
import { getPublicationCardStats } from '@/lib/publicationCardStats'
import type { Metadata } from 'next'
import '../../styles.css'

type Params = { slug: string }

/** Ищет человекочитаемый label тега по его slug среди документов. */
function labelFor(docs: any[], slug: string): string {
  for (const d of docs) {
    const t = (Array.isArray(d?.tags) ? d.tags : []).find((x: any) => x?.slug === slug)
    if (t?.label) return String(t.label)
  }
  return slug
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params
  const ctx = await getTenantFromHeaders()
  if (!ctx) return {}
  const { tenant, settings } = ctx
  return buildMetadata({
    defaults: settings?.seoDefaults,
    levels: [],
    fallbackTitle: `Тег: ${slug}`,
    brandName: tenant.name,
  })
}

export default async function TagPage({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { slug } = await params
  const sp = await searchParams
  const PER = [25, 50, 100]
  const per = PER.includes(Number(sp?.per)) ? Number(sp?.per) : 25
  const page = Math.max(1, Number(sp?.page) || 1)
  const ctx = await getTenantFromHeaders()
  if (!ctx) return <div className="p-8">Тенант не определён.</div>
  const { tenant, settings } = ctx

  const payload = await getPayload({ config: await config })

  // Публикации и видео с этим тегом (по slug). Публикации — только опубликованные.
  const [pubsRes, vidsRes] = await Promise.all([
    payload.find({
      collection: 'publications',
      where: {
        and: [
          { tenant: { equals: tenant.id } },
          { 'tags.slug': { equals: slug } },
          publishedWhere(),
        ],
      },
      sort: '-publishedAt',
      limit: per,
      page,
      depth: 1,
      overrideAccess: true,
    }),
    payload.find({
      collection: 'videos',
      where: {
        and: [{ tenant: { equals: tenant.id } }, { 'tags.slug': { equals: slug } }, { or: [{ embedStatus: { not_equals: 'unavailable' } }, { embedStatus: { exists: false } }] }],
      },
      sort: '-createdAt',
      limit: 50,
      depth: 1,
      overrideAccess: true,
    }),
  ])

  const pubs = pubsRes.docs as any[]
  const videos = vidsRes.docs as any[]

  // Тег без материалов не должен давать пустую индексируемую страницу.
  const pubTotal = pubsRes.totalDocs || pubs.length
  const pubPages = pubsRes.totalPages || 1
  if (pubTotal === 0 && videos.length === 0) notFound()

  const label = labelFor(pubs.length ? pubs : videos, slug)

  const cardStats = pubs.length
    ? await getPublicationCardStats(
        pubs.map((p) => p.id),
        tenant.id as number,
      )
    : new Map<string, { comments: number; reactions: number }>()

  return (
    <main className="page-canvas" style={{ ...brandVars(settings), minHeight: '100vh' }}>
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div style={{ color: 'var(--brand-muted)', fontSize: 14, marginBottom: 4 }}>Тег</div>
        <h1 className="text-3xl lg:text-5xl font-extrabold mb-8" style={{ color: 'var(--brand-text)' }}>
          <span style={{ opacity: 0.5 }}>#</span>
          {label}
        </h1>

        {pubs.length > 0 && (
          <div className="mb-14">
            <LatestPublicationsBlock
              heading={videos.length > 0 ? 'Материалы' : ''}
              items={pubs.map((p) => {
                const s = cardStats.get(String(p.id))
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

        {pubTotal > 0 && (
          <div className="mb-14">
            <ListPagination page={page} totalPages={pubPages} per={per} total={pubTotal} basePath={`/tag/${slug}`} />
          </div>
        )}

        {videos.length > 0 && (
          <div>
            <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--brand-text)' }}>
              Смотреть
            </h2>
            <div className="tag-vidgrid">
              {videos.map((v) => {
                const url = videoThumbUrl(v)
                return (
                  <Link key={v.id} href={`/video/${v.slug}`} className="tag-vidcard">
                    <div className="tag-vidcard__frame">
                      {url ? (
                        <HoverPreviewImage poster={url} gif={videoGifUrl(v)} alt={v.title || ''} sizes="(max-width: 640px) 100vw, 200px" />
                      ) : (
                        <div className="tag-vidcard__placeholder" aria-hidden>
                          {(v.title || '?').slice(0, 1).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="tag-vidcard__title" style={{ color: 'var(--brand-text)' }}>
                      {v.title || 'Без названия'}
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        )}
      </div>

      <style>{`
        .tag-vidgrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px; }
        .tag-vidcard { text-decoration: none; display: block; }
        .tag-vidcard__frame { position: relative; aspect-ratio: 16/9; border-radius: 12px; overflow: hidden; background: color-mix(in srgb, var(--brand-primary) 10%, transparent); }
        .tag-vidcard__frame img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
        .tag-vidcard__placeholder { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 28px; font-weight: 700; color: var(--brand-muted); }
        .tag-vidcard__title { margin-top: 8px; font-size: 14px; font-weight: 600; line-height: 1.3; }
      `}</style>
    </main>
  )
}
