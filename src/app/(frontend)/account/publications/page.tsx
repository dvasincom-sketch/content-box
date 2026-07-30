import React from 'react'
import Link from 'next/link'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getCurrentSubscriber } from '@/lib/currentSubscriber'
import { isPublished } from '@/lib/published'
import { getTenantFromHeaders } from '@/lib/tenant'

/** Мои публикации: опубликованные + заявки (на проверке / отклонённые), одним списком. */
export const dynamic = 'force-dynamic'

function fmt(iso?: string | null): string {
  if (!iso) return ''
  try { return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' }) } catch { return '' }
}
function ts(iso?: string | null): number {
  const n = iso ? Date.parse(iso) : NaN
  return Number.isFinite(n) ? n : 0
}

type Status = 'published' | 'unpublished' | 'pending' | 'rejected'
type Row = { key: string; title: string; status: Status; href?: string; date: string; sort: number; section?: string | null; reason?: string | null }

export default async function AccountPublicationsPage() {
  const sub = await getCurrentSubscriber()
  if (!sub) return null
  const ctx = await getTenantFromHeaders()
  const tid = (ctx as any)?.tenant?.id
  const payload = await getPayload({ config: await config })

  const pubs = tid
    ? await payload.find({ collection: 'publications', where: { and: [{ tenant: { equals: tid } }, { author: { equals: sub.id } }] }, sort: '-publishedAt', limit: 100, depth: 0, overrideAccess: true })
    : { docs: [] as any[] }
  const subs = tid
    ? await payload.find({ collection: 'submissions', where: { and: [{ tenant: { equals: tid } }, { author: { equals: sub.id } }, { status: { not_equals: 'approved' } }] }, sort: '-createdAt', limit: 100, depth: 0, overrideAccess: true })
    : { docs: [] as any[] }

  const rows: Row[] = []
  for (const p of pubs.docs as any[]) {
    // Статус выводим из данных, а не хардкодим. Материал, снятый с публикации
    // модератором (publishedAt → null) или отложенный, раньше показывался как
    // «Опубликовано» со ссылкой, которая теперь отдаёт 404.
    const live = isPublished(p)
    rows.push({
      key: `p${p.id}`,
      title: p.title,
      status: live ? 'published' : 'unpublished',
      href: live ? `/publication/${p.slug}` : undefined,
      date: fmt(p.publishedAt || p.createdAt),
      sort: ts(p.publishedAt || p.createdAt),
      section: p.section,
    })
  }
  for (const s of subs.docs as any[]) {
    rows.push({ key: `s${s.id}`, title: s.title, status: s.status === 'rejected' ? 'rejected' : 'pending', date: fmt(s.createdAt), sort: ts(s.createdAt), reason: s.rejectReason })
  }
  rows.sort((a, b) => b.sort - a.sort)

  const badge = (st: Status) => {
    const map = {
      published: { t: 'Опубликовано', c: 'var(--success)' },
      unpublished: { t: 'Снято с публикации', c: 'var(--brand-muted)' },
      pending: { t: 'На проверке', c: 'var(--warn)' },
      rejected: { t: 'Отклонено', c: 'var(--danger)' },
    }[st]
    return (
      <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 999, color: map.c, background: `color-mix(in srgb, ${map.c} 16%, transparent)`, whiteSpace: 'nowrap' }}>
        {map.t}
      </span>
    )
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: 26, color: 'var(--brand-text)', margin: 0 }}>Мои публикации</h1>
        <Link href="/account/submit" className="c-btn c-btn--primary">Написать публикацию</Link>
      </div>

      {rows.length === 0 ? (
        <p style={{ color: 'var(--brand-muted)' }}>Пока нет публикаций. Напишите первую!</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rows.map((r) => (
            <div key={r.key} className="c-card" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <div style={{ minWidth: 0 }}>
                {r.href ? (
                  <Link href={r.href} style={{ color: 'var(--brand-text)', fontWeight: 600 }}>{r.title}</Link>
                ) : (
                  <span style={{ color: 'var(--brand-text)', fontWeight: 600 }}>{r.title}</span>
                )}
                <div style={{ fontSize: 12, color: 'var(--brand-muted)', marginTop: 2 }}>
                  {r.date}
                  {r.status === 'published' && r.section === 'community' ? ' · Сообщество' : ''}
                  {r.reason ? ` · ${r.reason}` : ''}
                </div>
              </div>
              {badge(r.status)}
            </div>
          ))}
        </div>
      )}
    </>
  )
}
