import React from 'react'
import Link from 'next/link'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getCurrentSubscriber } from '@/lib/currentSubscriber'
import { levelProgress } from '@/lib/reputation'
import { earnedBadges } from '@/lib/badges'

/** Витрина профиля (обзор): аватар, имя, email, уровень, значки, статистика. */
export const dynamic = 'force-dynamic'

export default async function AccountOverviewPage() {
  const sub = await getCurrentSubscriber()
  if (!sub) return null
  const payload = await getPayload({ config: await config })
  const full = (await payload.findByID({ collection: 'subscribers', id: sub.id, depth: 1, overrideAccess: true })) as any

  const avatarUrl = full?.avatar && typeof full.avatar === 'object' ? full.avatar.url : null
  const name = full?.displayName || full?.email || 'Участник'
  const handle: string = full?.handle || ''
  const points = Number(full?.points) || 0
  const prog = levelProgress(points)
  const hasPaid = Boolean(full?.activeTier)

  const commentCount = await payload
    .count({ collection: 'comments', where: { and: [{ author: { equals: sub.id } }, { status: { equals: 'published' } }] }, overrideAccess: true })
    .then((r: any) => r.totalDocs).catch(() => 0)
  const reactionsReceived = await payload
    .count({ collection: 'activity-events' as any, where: { and: [{ subscriber: { equals: sub.id } }, { type: { equals: 'reaction_received' } }] }, overrideAccess: true })
    .then((r: any) => r.totalDocs).catch(() => 0)
  const badges = earnedBadges({ commentCount, reactionsReceived, level: Number(full?.level) || 0, hasPaidTier: hasPaid })

  return (
    <>
      <h1 style={{ fontSize: 26, color: 'var(--brand-text)', marginBottom: 20 }}>Профиль</h1>

      <div className="c-card" style={{ padding: 24, display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
        <span className="acct__ava" style={{ width: 64, height: 64, fontSize: 26 }}>
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="" />
          ) : (
            (name[0] || '?').toUpperCase()
          )}
        </span>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--brand-text)' }}>{name}</div>
          {handle && <div style={{ color: 'var(--brand-muted)' }}>@{handle}</div>}
          <div style={{ color: 'var(--brand-muted)', fontSize: 13, marginTop: 4 }}>{full?.email}</div>
        </div>
        {handle && !full?.profilePrivate && (
          <Link href={`/u/${handle}`} className="c-btn c-btn--surface">Публичный профиль</Link>
        )}
      </div>

      <div className="c-card lvl" style={{ marginBottom: 16 }}>
        <div className="lvl__top">
          <span className="lvl__name">
            Уровень: {prog.name}
            <span className="lvl__hint" title="Очки растут за одобренные комментарии и полученные реакции. Уровень открывает значки и новые возможности.">?</span>
          </span>
          {prog.nextName && <span className="lvl__next">Следующий: {prog.nextName}</span>}
        </div>
        <div className="lvl__bar"><div className="lvl__bar-fill" style={{ width: `${prog.pct}%` }} /></div>
        <div className="lvl__pts">
          {points} очков{prog.nextName ? ` · до «${prog.nextName}» — ${prog.toNext}` : ' · максимальный уровень'}
        </div>

        {badges.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
            {badges.map((b) => (
              <span
                key={b.id}
                title={b.desc}
                style={{
                  fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 999,
                  color: b.exclusive ? 'var(--brand-accent)' : 'var(--brand-text)',
                  background: b.exclusive ? 'color-mix(in srgb, var(--brand-accent) 14%, transparent)' : 'color-mix(in srgb, var(--brand-text) 8%, transparent)',
                }}
              >
                {b.name}
              </span>
            ))}
          </div>
        )}

        {!hasPaid && (
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--brand-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ color: 'var(--brand-muted)' }}>
              Эксклюзивный значок и приоритет в сообществе — <span style={{ color: 'var(--brand-text)' }}>по подписке</span>.
            </span>
            <Link href="/subscribe" className="c-btn c-btn--primary">Оформить подписку</Link>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {[{ k: 'Комментарии', v: commentCount }, { k: 'Реакции', v: reactionsReceived }].map((s) => (
          <div key={s.k} className="c-card" style={{ padding: '14px 20px', minWidth: 120 }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--brand-text)' }}>{s.v}</div>
            <div style={{ fontSize: 13, color: 'var(--brand-muted)' }}>{s.k}</div>
          </div>
        ))}
      </div>
    </>
  )
}
