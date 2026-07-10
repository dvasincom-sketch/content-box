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
import type { Metadata } from 'next'
import '../../styles.css'

type Params = { slug: string }

const PLATFORM_LABEL: Record<string, string> = {
  boosty: 'Смотреть на Boosty', vk: 'Смотреть в VK Видео',
  telegram: 'Смотреть в Telegram', youtube: 'Смотреть на YouTube',
}

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
        {/* Хлебные крошки: путь категории + сама публикация */}
        <nav className="text-sm mb-6 flex flex-wrap items-center gap-x-2 gap-y-1"
          style={{ color: 'var(--brand-text)', opacity: 0.7 }}
          aria-label="Хлебные крошки">
          <Link href="/" className="hover:opacity-100">Главная</Link>
          {((category?.breadcrumbs ?? []) as { url?: string; label?: string }[]).map((crumb, i) => (
            <span key={crumb.url ?? i} className="flex items-center gap-x-2">
              <span aria-hidden="true">/</span>
              <Link href={`/category${crumb.url}`} className="hover:opacity-100">{crumb.label}</Link>
            </span>
          ))}
          <span aria-hidden="true">/</span>
          <span style={{ opacity: 1 }}>{pub.title}</span>
        </nav>

        <div className="flex items-center gap-3 mb-4 text-sm" style={{ color: 'var(--brand-text)', opacity: 0.7 }}>
          {category && (
            <Link href={categoryHref(category)} className="px-3 py-1 rounded-full" style={{ background: 'color-mix(in srgb, var(--brand-primary) 25%, transparent)' }}>{category.title}</Link>
          )}
          {dateStr && <span>{dateStr}</span>}
        </div>

        <h1 className="text-3xl lg:text-5xl font-extrabold mb-6" style={{ color: 'var(--brand-text)' }}>{pub.title}</h1>

        <div className="relative rounded-2xl h-56 lg:h-80 mb-8 overflow-hidden"
          style={{ background: 'linear-gradient(135deg, var(--brand-primary), var(--brand-accent))' }}>
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
        </div>

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
