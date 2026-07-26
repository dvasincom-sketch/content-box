import React from 'react'
import Link from 'next/link'
import { ExternalLink, Settings as SettingsIcon } from 'lucide-react'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getCurrentSubscriber } from '@/lib/currentSubscriber'
import { levelProgress, LEVELS, POINT_WEIGHTS } from '@/lib/reputation'
import { earnedBadges } from '@/lib/badges'

/** Витрина профиля: кто я, уровень с объяснением, значки, статистика. */
export const dynamic = 'force-dynamic'

export default async function AccountOverviewPage() {
  const sub = await getCurrentSubscriber()
  if (!sub) return null
  const payload = await getPayload({ config: await config })
  const full = (await payload.findByID({ collection: 'subscribers', id: sub.id, depth: 1, overrideAccess: true })) as any

  const name = full?.displayName || full?.email || 'Участник'
  const handle: string = full?.handle || ''
  const isPrivate = Boolean(full?.profilePrivate)
  const points = Number(full?.points) || 0
  const prog = levelProgress(points)
  const hasPaid = Boolean(full?.activeTier)

  const commentCount = await payload
    .count({ collection: 'comments', where: { and: [{ author: { equals: sub.id } }, { status: { equals: 'published' } }] }, overrideAccess: true })
    .then((r: any) => r.totalDocs).catch(() => 0)
  const reactionsReceived = await payload
    .count({ collection: 'activity-events' as any, where: { and: [{ subscriber: { equals: sub.id } }, { type: { equals: 'reaction_received' } }] }, overrideAccess: true })
    .then((r: any) => r.totalDocs).catch(() => 0)
  const followerCount = await payload
    .count({ collection: 'follows' as any, where: { following: { equals: sub.id } }, overrideAccess: true })
    .then((r: any) => r.totalDocs).catch(() => 0)
  const followingCount = await payload
    .count({ collection: 'follows' as any, where: { follower: { equals: sub.id } }, overrideAccess: true })
    .then((r: any) => r.totalDocs).catch(() => 0)
  const badges = earnedBadges({ commentCount, reactionsReceived, level: Number(full?.level) || 0, hasPaidTier: hasPaid })

  const ladder = LEVELS.map((l) => l.name).join(' → ')

  return (
    <>
      <h1 style={{ fontSize: 26, color: 'var(--brand-text)', marginBottom: 20 }}>Профиль</h1>

      {/* Кто я (без аватара — он в боковом меню) */}
      <div className="c-card" style={{ padding: 24, marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--brand-text)' }}>{name}</div>
          {handle && <div style={{ color: 'var(--brand-muted)', marginTop: 2 }}>@{handle}</div>}
          <div style={{ color: 'var(--brand-muted)', fontSize: 13, marginTop: 2 }}>{full?.email}</div>
        </div>
        {handle && !isPrivate ? (
          <Link href={`/u/${handle}`} className="c-btn c-btn--surface" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <ExternalLink size={16} /> Открыть публичный профиль
          </Link>
        ) : (
          <Link href="/account/settings" className="c-btn c-btn--surface" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <SettingsIcon size={16} /> {handle ? 'Профиль скрыт — настройки' : 'Задать адрес профиля'}
          </Link>
        )}
      </div>

      {/* Уровень с объяснением */}
      <div className="c-card lvl" style={{ marginBottom: 16 }}>
        <div className="lvl__top">
          <span className="lvl__name">Уровень: {prog.name}</span>
          {prog.nextName && <span className="lvl__next">Следующий: {prog.nextName}</span>}
        </div>
        <div className="lvl__bar"><div className="lvl__bar-fill" style={{ width: `${prog.pct}%` }} /></div>
        <div className="lvl__pts">
          {points} очков{prog.nextName ? ` · до «${prog.nextName}» — ${prog.toNext}` : ' · максимальный уровень'}
        </div>

        <div style={{ marginTop: 14, fontSize: 14, color: 'var(--brand-muted)', lineHeight: 1.55 }}>
          <p style={{ margin: 0 }}>
            Очки — за активность: <b style={{ color: 'var(--brand-text)' }}>+{POINT_WEIGHTS.comment}</b> за одобренный комментарий и{' '}
            <b style={{ color: 'var(--brand-text)' }}>+{POINT_WEIGHTS.reaction_received}</b> за реакцию на ваш комментарий.
            {prog.nextName ? ` До «${prog.nextName}» осталось ${prog.toNext} — это буквально пара комментариев.` : ''}
          </p>
          <p style={{ margin: '8px 0 0' }}>
            Всего 6 уровней: {ladder}. С каждым открываются новые значки и возможности — своя модерация в сообществе,
            публикации без проверки, больше внимания к вашему профилю.
          </p>
        </div>

        {!hasPaid && (
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--brand-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ color: 'var(--brand-text)', fontWeight: 600, marginBottom: 2 }}>Подписка ускоряет и выделяет</div>
              <div style={{ color: 'var(--brand-muted)', fontSize: 14, lineHeight: 1.5 }}>
                Эксклюзивный значок «Подписчик», ускоренная прокачка уровня и приоритет: ваш профиль и комментарии заметнее в сообществе.
              </div>
            </div>
            <Link href="/subscribe" className="c-btn c-btn--primary">Оформить подписку</Link>
          </div>
        )}
      </div>

      {/* Значки */}
      {badges.length > 0 && (
        <div className="c-card" style={{ padding: 20, marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--brand-text)', marginBottom: 10 }}>Значки</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
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
        </div>
      )}

      {/* Статистика */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {[{ k: 'Подписчики', v: followerCount }, { k: 'Подписки', v: followingCount }, { k: 'Комментарии', v: commentCount }, { k: 'Реакции', v: reactionsReceived }].map((s) => (
          <div key={s.k} className="c-card" style={{ padding: '14px 20px', minWidth: 120 }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--brand-text)' }}>{s.v}</div>
            <div style={{ fontSize: 13, color: 'var(--brand-muted)' }}>{s.k}</div>
          </div>
        ))}
      </div>
    </>
  )
}
