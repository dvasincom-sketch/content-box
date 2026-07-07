import { getPayload } from 'payload'
import config from '@/payload.config'
import { notFound } from 'next/navigation'
import { RichText } from '@payloadcms/richtext-lexical/react'
import { getTenantFromHeaders } from '@/lib/tenant'
import { brandVars } from '@/lib/brand'
import '../../styles.css'

type Params = { slug: string }

const PLATFORM_LABEL: Record<string, string> = {
  boosty: 'Смотреть на Boosty', vk: 'Смотреть в VK Видео',
  telegram: 'Смотреть в Telegram', youtube: 'Смотреть на YouTube',
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
  const external = (pub.sources ?? []).filter((s: any) => s.type === 'external' && s.url)
  const dateStr = pub.publishedAt
    ? new Date(pub.publishedAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
    : null

  return (
    <main style={{ ...brandVars(settings?.theme), background: 'var(--brand-bg)', minHeight: '100vh' }}>
      <div className="max-w-3xl mx-auto px-4 py-8">
        <a href="/" className="text-sm inline-block mb-6" style={{ color: 'var(--brand-text)', opacity: 0.7 }}>← На главную</a>

        <div className="flex items-center gap-3 mb-4 text-sm" style={{ color: 'var(--brand-text)', opacity: 0.7 }}>
          {category && (
            <a href={`/category/${category.slug}`} className="px-3 py-1 rounded-full" style={{ background: 'color-mix(in srgb, var(--brand-primary) 25%, transparent)' }}>{category.title}</a>
          )}
          {dateStr && <span>{dateStr}</span>}
        </div>

        <h1 className="text-3xl lg:text-5xl font-extrabold mb-6" style={{ color: 'var(--brand-text)' }}>{pub.title}</h1>

        <div className="rounded-2xl h-56 mb-8" style={{ background: 'linear-gradient(135deg, var(--brand-primary), var(--brand-accent))' }} />

        {pub.description && (
          <div className="prose-invert max-w-none mb-8 leading-relaxed" style={{ color: 'var(--brand-text)', opacity: 0.9 }}>
            <RichText data={pub.description} />
          </div>
        )}

        {external.length > 0 && (
          <div className="flex flex-wrap gap-3">
            {external.map((s: any, i: number) => (
              <a key={i} href={s.url} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold px-5 py-3 rounded-xl transition-transform hover:-translate-y-0.5" style={{ background: 'var(--brand-primary)', color: '#fff' }}>
                {PLATFORM_LABEL[s.platform] ?? s.platform}
              </a>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
