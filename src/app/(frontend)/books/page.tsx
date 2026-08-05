import Link from 'next/link'
import Image from 'next/image'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getTenantFromHeaders } from '@/lib/tenant'
import { brandVars } from '@/lib/brand'
import { BookOpen } from 'lucide-react'
import type { Metadata } from 'next'
import '../styles.css'

export const dynamic = 'force-dynamic'

const TYPE_LABEL: Record<string, string> = { novel: 'Роман', story: 'Рассказ', mini: 'Миниатюра', cycle: 'Цикл' }
const STATUS_LABEL: Record<string, string> = { ongoing: 'В процессе', finished: 'Завершено', frozen: 'Заморожено' }

export async function generateMetadata(): Promise<Metadata> {
  const ctx = await getTenantFromHeaders()
  const name = (ctx?.tenant as any)?.name || ''
  return { title: name ? `Библиотека — ${name}` : 'Библиотека' }
}

export default async function BooksCatalogPage() {
  const ctx = await getTenantFromHeaders()
  if (!ctx) return <div className="p-8">Тенант не определён.</div>
  const { tenant, settings } = ctx

  const payload = await getPayload({ config: await config })
  const res = await payload.find({
    collection: 'books' as any,
    where: { and: [{ tenant: { equals: tenant.id } }, { publishedAt: { exists: true } }] },
    sort: '-publishedAt', limit: 500, depth: 1, overrideAccess: true,
  })

  const books = (res.docs as any[]).map((b) => ({
    id: b.id,
    slug: b.slug || String(b.id),
    title: b.title || 'Без названия',
    type: TYPE_LABEL[b.type || 'novel'] || 'Роман',
    status: STATUS_LABEL[b.status || 'ongoing'] || '',
    coverUrl: b.cover && typeof b.cover === 'object' ? (b.cover.url || null) : null,
  }))

  return (
    <main className="page-canvas" style={{ ...brandVars(settings), minHeight: '100vh' }}>
      <div className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-3xl lg:text-5xl font-extrabold mb-2" style={{ color: 'var(--brand-text)' }}>Библиотека</h1>
        <p className="mb-8 text-sm" style={{ color: 'var(--brand-muted)' }}>Произведения автора.</p>

        {books.length === 0 ? (
          <div className="rounded-2xl p-10 text-center" style={{ background: 'color-mix(in srgb, var(--brand-primary) 8%, transparent)', color: 'var(--brand-muted)' }}>
            Пока нет опубликованных произведений.
          </div>
        ) : (
          <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
            {books.map((b) => (
              <Link key={b.id} href={`/book/${b.slug}`} className="group">
                <div className="rounded-xl overflow-hidden mb-2 grid place-items-center" style={{ aspectRatio: '3 / 4', background: 'color-mix(in srgb, var(--brand-primary) 12%, transparent)' }}>
                  {b.coverUrl ? (
                    <Image src={b.coverUrl} alt="" width={300} height={400} className="object-cover w-full h-full" />
                  ) : <BookOpen size={32} style={{ color: 'var(--brand-primary)' }} />}
                </div>
                <div className="font-semibold leading-snug" style={{ color: 'var(--brand-text)' }}>{b.title}</div>
                <div className="text-xs" style={{ color: 'var(--brand-muted)' }}>{b.type} · {b.status}</div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
