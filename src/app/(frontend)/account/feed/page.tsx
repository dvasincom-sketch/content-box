import React from 'react'
import Link from 'next/link'
import { Users } from 'lucide-react'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getCurrentSubscriber } from '@/lib/currentSubscriber'
import { publishedWhere } from '@/lib/published'
import { getTenantFromHeaders } from '@/lib/tenant'

/** Лента подписок: свежие публикации авторов, на которых подписан (Фаза 5). */
export const dynamic = 'force-dynamic'

function relId(v: any): number | null {
  if (v == null) return null
  const raw = typeof v === 'object' ? v.id : v
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}
function fmt(iso?: string | null): string {
  if (!iso) return ''
  try { return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' }) } catch { return '' }
}

export default async function FeedPage() {
  const sub = await getCurrentSubscriber()
  if (!sub) return null
  const tid = ((await getTenantFromHeaders()) as any)?.tenant?.id
  const payload = await getPayload({ config: await config })

  const follows = tid
    ? await payload.find({ collection: 'follows', where: { and: [{ tenant: { equals: tid } }, { follower: { equals: sub.id } }] }, limit: 500, depth: 0, overrideAccess: true })
    : { docs: [] as any[] }
  const ids = (follows.docs as any[]).map((f) => relId(f.following)).filter((x): x is number => x != null)

  let pubs: any[] = []
  if (ids.length > 0) {
    const res = await payload.find({
      collection: 'publications',
      where: { and: [{ tenant: { equals: tid } }, { author: { in: ids } }, publishedWhere()] },
      sort: '-publishedAt', limit: 40, depth: 1, overrideAccess: true,
    })
    pubs = res.docs as any[]
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <h1 style={{ fontSize: 26, color: 'var(--brand-text)' }}>Лента</h1>
        <Link href="/community" style={{ fontSize: 14, fontWeight: 600, color: 'var(--brand-primary)' }}>
          Лента сообщества →
        </Link>
      </div>
      {ids.length === 0 ? (
        <div className="c-card" style={{ padding: '30px 24px', textAlign: 'center' }}>
          <span
            style={{
              display: 'inline-grid', placeItems: 'center', width: 56, height: 56, borderRadius: 16, marginBottom: 14,
              background: 'color-mix(in srgb, var(--brand-primary) 12%, transparent)', color: 'var(--brand-primary)',
            }}
          >
            <Users size={26} />
          </span>
          <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--brand-text)', marginBottom: 8 }}>
            Ваша лента пока пуста
          </div>
          <p style={{ color: 'var(--brand-muted)', fontSize: 14, lineHeight: 1.55, maxWidth: 440, margin: '0 auto 18px' }}>
            Подпишитесь на участников — и их публикации будут собираться здесь. Загляните в ленту сообщества и выберите авторов, чьи материалы вам близки.
          </p>
          <Link href="/community" className="c-btn c-btn--primary">
            Смотреть публикации участников
          </Link>
        </div>
      ) : pubs.length === 0 ? (
        <p style={{ color: 'var(--brand-muted)' }}>У ваших авторов пока нет публикаций.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {pubs.filter((p) => p.slug).map((p) => {
            const a = p.author && typeof p.author === 'object' ? p.author : null
            return (
              <div key={p.id} className="c-card" style={{ padding: 16 }}>
                <Link href={`/publication/${p.slug}`} style={{ color: 'var(--brand-text)', fontWeight: 600 }}>{p.title}</Link>
                <div style={{ fontSize: 12, color: 'var(--brand-muted)', marginTop: 2 }}>
                  {a?.displayName || (a?.handle ? `@${a.handle}` : 'Автор')} · {fmt(p.publishedAt || p.createdAt)}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
