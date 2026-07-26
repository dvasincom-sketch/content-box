import React from 'react'
import Link from 'next/link'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getCurrentSubscriber } from '@/lib/currentSubscriber'
import { getTenantFromHeaders } from '@/lib/tenant'

/** «Посмотреть позже» — сохранённые публикации и видео (Фаза 5). */
export const dynamic = 'force-dynamic'

export default async function SavedPage() {
  const sub = await getCurrentSubscriber()
  if (!sub) return null
  const tid = ((await getTenantFromHeaders()) as any)?.tenant?.id
  const payload = await getPayload({ config: await config })
  const res = tid
    ? await payload.find({ collection: 'bookmarks' as any, where: { and: [{ tenant: { equals: tid } }, { subscriber: { equals: sub.id } }] }, sort: '-createdAt', limit: 100, depth: 1, overrideAccess: true })
    : { docs: [] as any[] }

  const rows = (res.docs as any[])
    .map((b) => {
      const isVid = b.targetType === 'video'
      const o = (isVid ? b.video : b.publication)
      const obj = o && typeof o === 'object' ? o : null
      return { key: `b${b.id}`, title: obj?.title || 'Материал', href: obj?.slug ? (isVid ? `/video/${obj.slug}` : `/publication/${obj.slug}`) : null, type: isVid ? 'Видео' : 'Публикация' }
    })
    .filter((r) => r.href)

  return (
    <>
      <h1 style={{ fontSize: 26, color: 'var(--brand-text)', marginBottom: 20 }}>Сохранённое</h1>
      {rows.length === 0 ? (
        <p style={{ color: 'var(--brand-muted)' }}>Пока пусто. Нажимайте «Сохранить» на публикациях и видео — вернётесь к ним здесь.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rows.map((r) => (
            <div key={r.key} className="c-card" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <Link href={r.href!} style={{ color: 'var(--brand-text)', fontWeight: 600 }}>{r.title}</Link>
              <span style={{ fontSize: 12, color: 'var(--brand-muted)' }}>{r.type}</span>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
