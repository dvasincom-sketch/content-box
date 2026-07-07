import { getPayload } from 'payload'
import config from '@/payload.config'
import { notFound } from 'next/navigation'
import { getTenantFromHeaders } from '@/lib/tenant'
import { brandVars } from '@/lib/brand'
import { LatestPublicationsBlock } from '@/blocks/LatestPublicationsBlock'
import '../../styles.css'

type Params = { slug: string }

export default async function CategoryPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params

  const ctx = await getTenantFromHeaders()
  if (!ctx) {
    return <div className="p-8">Тенант не определён.</div>
  }
  const { tenant, settings } = ctx

  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })

  // категория по паре tenant + slug (slug уникален в пределах тенанта)
  const catRes = await payload.find({
    collection: 'categories',
    where: { and: [{ tenant: { equals: tenant.id } }, { slug: { equals: slug } }] },
    limit: 1, depth: 0, overrideAccess: true,
  })
  const category = catRes.docs[0] as any
  if (!category) notFound()

  // публикации этой категории
  const pubsRes = await payload.find({
    collection: 'publications',
    where: { and: [{ tenant: { equals: tenant.id } }, { category: { equals: category.id } }] },
    sort: '-publishedAt', depth: 1, limit: 50, overrideAccess: true,
  })
  const pubs = pubsRes.docs as any[]

  return (
    <main style={{ ...brandVars(settings?.theme), background: 'var(--brand-bg)', minHeight: '100vh' }}>
      <div className="max-w-6xl mx-auto px-4 py-8">
        <a href="/" className="text-sm inline-block mb-6" style={{ color: 'var(--brand-text)', opacity: 0.7 }}>
          ← На главную
        </a>
        <h1 className="text-3xl lg:text-5xl font-extrabold mb-2" style={{ color: 'var(--brand-text)' }}>
          {category.title}
        </h1>
        {category.description && (
          <p className="mb-8 text-base" style={{ color: 'var(--brand-text)', opacity: 0.7 }}>
            {category.description}
          </p>
        )}

        {pubs.length === 0 ? (
          <p style={{ color: 'var(--brand-text)', opacity: 0.7 }}>В этой категории пока нет публикаций.</p>
        ) : (
          <LatestPublicationsBlock
            heading=""
            items={pubs.map((p) => ({
              id: p.id, slug: p.slug, title: p.title, publishedAt: p.publishedAt, sources: p.sources,
            }))}
          />
        )}
      </div>
    </main>
  )
}
