import React from 'react'
import Link from 'next/link'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getCurrentSubscriber } from '@/lib/currentSubscriber'
import { getTenantFromHeaders } from '@/lib/tenant'

/** История просмотров участника (приватная, Фаза 5). */
export const dynamic = 'force-dynamic'

function fmt(iso?: string | null): string {
  if (!iso) return ''
  try { return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' }) } catch { return '' }
}

export default async function HistoryPage() {
  const sub = await getCurrentSubscriber()
  if (!sub) return null
  const full = sub as any
  const tid = ((await getTenantFromHeaders()) as any)?.tenant?.id
  const payload = await getPayload({ config: await config })
  let res: { docs: any[] } = { docs: [] }
  if (tid) {
    try {
      res = await payload.find({ collection: 'views', where: { and: [{ tenant: { equals: tid } }, { subscriber: { equals: sub.id } }] }, sort: '-viewedAt', limit: 100, depth: 1, overrideAccess: true }) as any
    } catch {
      res = { docs: [] }
    }
  }

  const rows = (res.docs as any[])
    .map((v) => {
      const isVid = v.targetType === 'video'
      const o = (isVid ? v.video : v.publication)
      const obj = o && typeof o === 'object' ? o : null
      return { key: `v${v.id}`, title: obj?.title || 'Материал', href: obj?.slug ? (isVid ? `/video/${obj.slug}` : `/publication/${obj.slug}`) : null, type: isVid ? 'Видео' : 'Публикация', date: fmt(v.viewedAt || v.updatedAt) }
    })
    .filter((r) => r.href)

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: 26, color: 'var(--brand-text)', margin: 0 }}>История</h1>
        <Link href="/account/settings" className="c-btn c-btn--surface c-btn--sm">Настройки истории</Link>
      </div>
      {full.historyEnabled === false ? (
        <p style={{ color: 'var(--brand-muted)' }}>История выключена. Включить и очистить можно в Настройках.</p>
      ) : rows.length === 0 ? (
        <p style={{ color: 'var(--brand-muted)' }}>Здесь появится то, что вы открывали.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rows.map((r) => (
            <div key={r.key} className="c-card" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <div style={{ minWidth: 0 }}>
                <Link href={r.href!} style={{ color: 'var(--brand-text)', fontWeight: 600 }}>{r.title}</Link>
                <div style={{ fontSize: 12, color: 'var(--brand-muted)', marginTop: 2 }}>{r.type} · {r.date}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
