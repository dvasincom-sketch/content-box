import React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getCurrentSubscriber } from '@/lib/currentSubscriber'
import { getTenantFromHeaders } from '@/lib/tenant'
import { BookOpen } from 'lucide-react'

/** Личная библиотека читателя: Читаю / Хочу прочитать / Прочитано. */
export const dynamic = 'force-dynamic'

type Row = { bookId: string; slug: string; title: string; coverUrl: string | null; lastOrder: number | null; maxOrder: number | null; bookmarked: boolean }

function bookOf(v: any) {
  const b = v?.book
  return b && typeof b === 'object' ? b : null
}

export default async function LibraryPage() {
  const sub = await getCurrentSubscriber()
  if (!sub) return null
  const tid = ((await getTenantFromHeaders()) as any)?.tenant?.id
  const payload = await getPayload({ config: await config })
  if (!tid) return <p style={{ color: 'var(--brand-muted)' }}>Тенант не определён.</p>

  const [bmRes, pvRes, bfRes] = await Promise.all([
    payload.find({ collection: 'bookmarks', where: { and: [{ tenant: { equals: tid } }, { subscriber: { equals: sub.id } }, { targetType: { equals: 'book' } }] }, limit: 500, depth: 2, overrideAccess: true }),
    payload.find({ collection: 'views', where: { and: [{ tenant: { equals: tid } }, { subscriber: { equals: sub.id } }, { targetType: { equals: 'book' } }] }, limit: 500, depth: 2, overrideAccess: true }),
    payload.find({ collection: 'book-follows' as any, where: { and: [{ tenant: { equals: tid } }, { subscriber: { equals: sub.id } }] }, limit: 500, depth: 2, overrideAccess: true }),
  ])
  const following: Row[] = []
  for (const f of bfRes.docs as any[]) {
    const b = f.book && typeof f.book === 'object' ? f.book : null
    if (!b) continue
    following.push({ bookId: String(b.id), slug: b.slug || String(b.id), title: b.title || 'Без названия', coverUrl: b.cover && typeof b.cover === 'object' ? (b.cover.url || null) : null, lastOrder: null, maxOrder: null, bookmarked: false })
  }

  const byId = new Map<string, Row>()
  const ensure = (b: any): Row | null => {
    if (!b) return null
    const id = String(b.id)
    if (!byId.has(id)) {
      byId.set(id, {
        bookId: id, slug: b.slug || id, title: b.title || 'Без названия',
        coverUrl: b.cover && typeof b.cover === 'object' ? (b.cover.url || null) : null,
        lastOrder: null, maxOrder: null, bookmarked: false,
      })
    }
    return byId.get(id)!
  }

  for (const bm of bmRes.docs as any[]) { const r = ensure(bookOf(bm)); if (r) r.bookmarked = true }
  for (const v of pvRes.docs as any[]) {
    const r = ensure(bookOf(v)); if (!r) continue
    const ch = v.chapter
    if (ch && typeof ch === 'object' && ch.order != null) r.lastOrder = Number(ch.order)
  }

  // Максимальный номер главы по каждой книге (для «Прочитано»).
  const ids = [...byId.keys()].map(Number).filter(Boolean)
  if (ids.length) {
    const chRes = await payload.find({ collection: 'chapters' as any, where: { and: [{ tenant: { equals: tid } }, { book: { in: ids } }] }, limit: 5000, depth: 0, overrideAccess: true })
    for (const c of chRes.docs as any[]) {
      const bid = String(typeof c.book === 'object' ? c.book?.id : c.book)
      const r = byId.get(bid); if (!r) continue
      const o = Number(c.order) || 0
      r.maxOrder = Math.max(r.maxOrder ?? 0, o)
    }
  }

  const rows = [...byId.values()]
  const reading = rows.filter((r) => r.lastOrder != null && !(r.maxOrder != null && r.lastOrder >= r.maxOrder))
  const finished = rows.filter((r) => r.lastOrder != null && r.maxOrder != null && r.lastOrder >= r.maxOrder)
  const want = rows.filter((r) => r.lastOrder == null && r.bookmarked)

  return (
    <>
      <h1 style={{ fontSize: 26, color: 'var(--brand-text)', margin: '0 0 20px' }}>Моя библиотека</h1>
      {rows.length === 0 && following.length === 0 ? (
        <p style={{ color: 'var(--brand-muted)' }}>Здесь появятся книги, которые вы читаете или добавили в библиотеку.</p>
      ) : (
        <>
          <Section title="Читаю" rows={reading} showContinue />
          <Section title="Хочу прочитать" rows={want} />
          <Section title="Прочитано" rows={finished} />
          <Section title="Отслеживаю обновления" rows={following} />
        </>
      )}
    </>
  )
}

function Section({ title, rows, showContinue }: { title: string; rows: Row[]; showContinue?: boolean }) {
  if (rows.length === 0) return null
  return (
    <div style={{ marginBottom: 28 }}>
      <h2 style={{ fontSize: 16, color: 'var(--brand-text)', margin: '0 0 12px' }}>{title} <span style={{ color: 'var(--brand-muted)', fontWeight: 400 }}>· {rows.length}</span></h2>
      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
        {rows.map((r) => (
          <div key={r.bookId} className="c-card" style={{ padding: 12, display: 'flex', gap: 12, alignItems: 'center' }}>
            <Link href={`/book/${r.slug}`} style={{ flex: 'none', width: 46, height: 61, borderRadius: 6, overflow: 'hidden', display: 'grid', placeItems: 'center', background: 'color-mix(in srgb, var(--brand-primary) 12%, transparent)' }}>
              {r.coverUrl ? <Image src={r.coverUrl} alt="" width={46} height={61} style={{ objectFit: 'cover', width: '100%', height: '100%' }} /> : <BookOpen size={18} style={{ color: 'var(--brand-primary)' }} />}
            </Link>
            <div style={{ minWidth: 0, flex: 1 }}>
              <Link href={`/book/${r.slug}`} style={{ color: 'var(--brand-text)', fontWeight: 600 }}>{r.title}</Link>
              {showContinue && r.lastOrder != null && (
                <div style={{ marginTop: 4 }}>
                  <Link href={`/book/${r.slug}/${r.lastOrder}`} style={{ fontSize: 13, color: 'var(--brand-primary)', fontWeight: 600 }}>Продолжить · глава {r.lastOrder}{r.maxOrder ? ` из ${r.maxOrder}` : ''}</Link>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
