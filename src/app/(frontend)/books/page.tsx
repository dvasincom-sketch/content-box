import Link from 'next/link'
import Image from 'next/image'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getTenantFromHeaders } from '@/lib/tenant'
import { brandVars } from '@/lib/brand'
import { BOOK_GENRES } from '@/lib/bookGenres'
import { BookOpen } from 'lucide-react'
import type { Metadata } from 'next'
import '../styles.css'

export const dynamic = 'force-dynamic'

const TYPE_LABEL: Record<string, string> = { novel: 'Роман', story: 'Рассказ', mini: 'Миниатюра', cycle: 'Цикл' }
const STATUS_LABEL: Record<string, string> = { ongoing: 'В процессе', finished: 'Завершено', frozen: 'Заморожено' }
const TYPE_FILTERS = [{ v: '', l: 'Все' }, { v: 'novel', l: 'Романы' }, { v: 'story', l: 'Рассказы' }, { v: 'mini', l: 'Миниатюры' }, { v: 'cycle', l: 'Циклы' }]
const STATUS_FILTERS = [{ v: '', l: 'Любой статус' }, { v: 'ongoing', l: 'В процессе' }, { v: 'finished', l: 'Завершено' }]

export async function generateMetadata(): Promise<Metadata> {
  const ctx = await getTenantFromHeaders()
  const name = (ctx?.tenant as any)?.name || ''
  return { title: name ? `Библиотека — ${name}` : 'Библиотека' }
}

type SP = { type?: string; status?: string; genre?: string }

export default async function BooksCatalogPage({ searchParams }: { searchParams: Promise<SP> }) {
  const ctx = await getTenantFromHeaders()
  if (!ctx) return <div className="p-8">Тенант не определён.</div>
  const { tenant, settings } = ctx
  const sp = await searchParams
  const type = sp.type || ''
  const status = sp.status || ''
  const genre = sp.genre || ''

  const qs = (over: Partial<SP>) => {
    const merged: SP = { type, status, genre, ...over }
    const p = new URLSearchParams()
    if (merged.type) p.set('type', merged.type)
    if (merged.status) p.set('status', merged.status)
    if (merged.genre) p.set('genre', merged.genre)
    const s = p.toString()
    return s ? `/books?${s}` : '/books'
  }

  const payload = await getPayload({ config: await config })
  const and: any[] = [{ tenant: { equals: tenant.id } }, { publishedAt: { exists: true } }]
  if (type) and.push({ type: { equals: type } })
  if (status) and.push({ status: { equals: status } })
  if (genre) and.push({ genres: { contains: genre } })

  const res = await payload.find({
    collection: 'books' as any,
    where: { and },
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

  const chip = (active: boolean) => ({
    display: 'inline-block', padding: '6px 14px', borderRadius: 999, fontSize: 14, fontWeight: 600,
    background: active ? 'var(--brand-primary)' : 'color-mix(in srgb, var(--brand-text) 8%, transparent)',
    color: active ? '#fff' : 'var(--brand-text)', textDecoration: 'none',
  }) as React.CSSProperties

  return (
    <main className="page-canvas" style={{ ...brandVars(settings), minHeight: '100vh' }}>
      <div className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-3xl lg:text-5xl font-extrabold mb-6" style={{ color: 'var(--brand-text)' }}>Библиотека</h1>

        {/* Фильтры */}
        <div className="flex flex-wrap gap-2 mb-3">
          {TYPE_FILTERS.map((f) => (
            <Link key={f.v} href={qs({ type: f.v })} style={chip(type === f.v)}>{f.l}</Link>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 mb-3">
          {STATUS_FILTERS.map((f) => (
            <Link key={f.v} href={qs({ status: f.v })} style={chip(status === f.v)}>{f.l}</Link>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 mb-8">
          <Link href={qs({ genre: '' })} style={chip(!genre)}>Все жанры</Link>
          {BOOK_GENRES.map((g) => (
            <Link key={g} href={qs({ genre: genre === g ? '' : g })} style={chip(genre === g)}>{g}</Link>
          ))}
        </div>

        {books.length === 0 ? (
          <div className="rounded-2xl p-10 text-center" style={{ background: 'color-mix(in srgb, var(--brand-primary) 8%, transparent)', color: 'var(--brand-muted)' }}>
            Ничего не найдено. {(type || status || genre) && <Link href="/books" style={{ color: 'var(--brand-primary)', fontWeight: 600 }}>Сбросить фильтры</Link>}
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
