import { getPayload } from 'payload'
import config from '@/payload.config'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getTenantFromHeaders } from '@/lib/tenant'
import { brandVars } from '@/lib/brand'
import { buildMetadata } from '@/lib/seo'
import type { Metadata } from 'next'
import '../../styles.css'

type Params = { slug: string }

async function loadFolder(tenantId: number, slug: string) {
  const payload = await getPayload({ config: await config })
  const folderRes = await payload.find({
    collection: 'gallery-folders',
    where: { and: [{ tenant: { equals: tenantId } }, { slug: { equals: slug } }] },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const folder = folderRes.docs[0] as { id: number; title?: string; slug?: string } | undefined
  if (!folder) return null
  const imgRes = await payload.find({
    collection: 'gallery-images',
    where: { and: [{ tenant: { equals: tenantId } }, { folder: { equals: folder.id } }] },
    sort: '-updatedAt',
    limit: 120,
    depth: 0,
    overrideAccess: true,
  })
  return { folder, images: imgRes.docs as any[] }
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params
  const ctx = await getTenantFromHeaders()
  if (!ctx) return {}
  const data = await loadFolder(ctx.tenant.id as number, slug)
  const title = data?.folder.title || 'Галерея'
  return buildMetadata({
    defaults: ctx.settings?.seoDefaults,
    fallbackTitle: title,
    brandName: ctx.tenant.name,
  })
}

export default async function GalleryFolderPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params
  const ctx = await getTenantFromHeaders()
  if (!ctx) return <div className="p-8">Тенант не определён.</div>
  const { settings } = ctx

  const data = await loadFolder(ctx.tenant.id as number, slug)
  if (!data) notFound()
  const { folder, images } = data

  return (
    <main className="page-canvas" style={{ ...brandVars(settings), minHeight: '100vh' }}>
      <div className="max-w-6xl mx-auto px-4 py-8">
        <Link href="/" className="gallery-back"><ArrowLeft size={16} /> На главную</Link>
        <h1 className="gallery-title">{folder.title || 'Галерея'}</h1>
        <p className="gallery-sub">{images.length} фото</p>

        {images.length === 0 ? (
          <p className="gallery-empty">В этой папке пока нет фотографий.</p>
        ) : (
          <div className="gallery-grid">
            {images.map((img) => {
              const thumb = img?.sizes?.thumbnail?.url || img?.url
              if (!thumb) return null
              const full = img?.sizes?.large?.url || img?.url
              return (
                <a key={img.id} href={full} target="_blank" rel="noopener noreferrer" className="gallery-cell">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={thumb} alt={img.alt || ''} loading="lazy" />
                </a>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
