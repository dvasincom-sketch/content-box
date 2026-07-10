import { getPayload } from 'payload'
import config from '@/payload.config'
import { notFound } from 'next/navigation'
import { getTenantFromHeaders } from '@/lib/tenant'
import { brandVars } from '@/lib/brand'
import { buildMetadata } from '@/lib/seo'
import type { Metadata } from 'next'
import { RichText } from '@/components/RichText'
import '../../styles.css'

type Params = { slug: string }

/** SEO-каскад (ТЗ §6): дефолт тенанта → страница. */
export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params
  const ctx = await getTenantFromHeaders()
  if (!ctx) return {}
  const { tenant, settings } = ctx

  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })
  const res = await payload.find({
    collection: 'pages',
    where: { and: [{ tenant: { equals: tenant.id } }, { slug: { equals: slug } }] },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  const page = res.docs[0] as any
  if (!page) return {}

  return buildMetadata({
    defaults: (settings as any)?.seoDefaults,
    levels: [page.seo],
    fallbackTitle: page.title,
    brandName: (tenant as any)?.name,
  })
}

export default async function ContentPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params
  const ctx = await getTenantFromHeaders()
  if (!ctx) return <div className="p-8">Тенант не определён.</div>
  const { tenant, settings } = ctx

  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })

  const res = await payload.find({
    collection: 'pages',
    where: { and: [{ tenant: { equals: tenant.id } }, { slug: { equals: slug } }] },
    limit: 1,
    depth: 1,
    overrideAccess: true,
  })

  const page = res.docs[0] as any
  if (!page) notFound()

  return (
    <main style={{ ...brandVars(settings?.theme), background: 'var(--brand-bg)', minHeight: '100vh' }}>
      <div className="max-w-6xl mx-auto px-4 py-10">
        {/* Крошки и заголовок — во всю ширину, как на странице категории. */}
        <a href="/" className="text-sm inline-block mb-6" style={{ color: 'var(--brand-text)', opacity: 0.7 }}>← На главную</a>
        <h1
          className="text-3xl lg:text-5xl font-extrabold mb-8"
          style={{ color: 'var(--brand-text)', fontFamily: 'var(--font-heading)', fontWeight: 'var(--heading-weight)' }}
        >
          {page.title}
        </h1>
        {/* Текст — узкая колонка по центру: читаемая длина строки. */}
        <div className="max-w-3xl mx-auto">
          <RichText data={page.content} />
        </div>
      </div>
    </main>
  )
}
