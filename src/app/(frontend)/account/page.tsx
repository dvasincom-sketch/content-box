import React from 'react'
import Link from 'next/link'
import { ExternalLink, Settings as SettingsIcon, Check, Sparkles } from 'lucide-react'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getCurrentSubscriber } from '@/lib/currentSubscriber'
import { levelProgress, LEVELS, POINT_WEIGHTS } from '@/lib/reputation'
import { earnedBadges } from '@/lib/badges'

/** Витрина профиля: уровень с понятной лестницей, значки, статистика. */
export const dynamic = 'force-dynamic'

// Что даёт каждый уровень (по порядку LEVELS).
const PERKS = [
  'Старт: комментарии и реакции',
  'Первые значки за активность',
  'Расширенная кастомизация профиля',
  'Модерация в сообществе — можно скрывать нарушения',
  'Публикации без проверки',
  'Особый статус и приоритет в сообществе',
]

export default async function AccountOverviewPage() {
  const sub = await getCurrentSubscriber()
  if (!sub) return null
  const payload = await getPayload({ config: await config })
  const full = (await payload.findByID({ collection: 'subscribers', id: sub.id, depth: 1, overrideAccess: true })) as any

  const handle: string = full?.handle || ''
  const isPrivate = Boolean(full?.profilePrivate)
  const points = Number(full?.points) || 0
  const prog = levelProgress(points)
  const hasPaid = Boolean(full?.activeTier)

  const commentCount = await payload
    .count({ collection: 'comments', where: { and: [{ author: { equals: sub.id } }, { status: { equals: 'published' } }] }, overrideAccess: true })
    .then((r: any) => r.totalDocs).catch(() => 0)
  const reactionsReceived = await payload
    .count({ collection: 'activity-events', where: { and: [{ subscriber: { equals: sub.id } }, { type: { equals: 'reaction_received' } }] }, overrideAccess: true })
    .then((r: any) => r.totalDocs).catch(() => 0)
  const followerCount = await payload
    .count({ collection: 'follows', where: { following: { equals: sub.id } }, overrideAccess: true })
    .then((r: any) => r.totalDocs).catch(() => 0)
  const followingCount = await payload
    .count({ collection: 'follows', where: { follower: { equals: sub.id } }, overrideAccess: true })
    .then((r: any) => r.totalDocs).catch(() => 0)
  const confirmedBugs = await payload
    .count({ collection: 'bug-reports', where: { and: [{ subscriber: { equals: sub.id } }, { status: { in: ['confirmed', 'fixed'] } }] }, overrideAccess: true })
    .then((r: any) => r.totalDocs).catch(() => 0)
  const badges = earnedBadges({ commentCount, reactionsReceived, level: Number(full?.level) || 0, hasPaidTier: hasPaid, confirmedBugs })

  return (
    <>
      {/* Заголовок + ссылка на публичный профиль по другую сторону */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: 26, color: 'var(--brand-text)', margin: 0 }}>Профиль</h1>
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

      {/* Уровень */}
      <div className="c-card lvl" style={{ marginBottom: 16 }}>
        <div className="lvl__top">
          <span className="lvl__name">Уровень: {prog.name}</span>
          {prog.nextName && <span className="lvl__next">Следующий: {prog.nextName}</span>}
        </div>
        <div className="lvl__bar"><div className="lvl__bar-fill" style={{ width: `${prog.pct}%` }} /></div>
        <div className="lvl__pts">
          {points} очков{prog.nextName ? ` · до «${prog.nextName}» — ${prog.toNext}` : ' · максимальный уровень'}
        </div>

        {/* Как заработать очки */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 14, fontSize: 14, color: 'var(--brand-muted)', lineHeight: 1.5 }}>
          <Sparkles size={16} style={{ color: 'var(--brand-primary)', flex: 'none', marginTop: 2 }} />
          <span>
            Очки — за активность: <b style={{ color: 'var(--brand-text)' }}>+{POINT_WEIGHTS.comment}</b> за одобренный комментарий,{' '}
            <b style={{ color: 'var(--brand-text)' }}>+{POINT_WEIGHTS.reaction_received}</b> за реакцию на ваш комментарий.
          </span>
        </div>

        {/* Лестница уровней — вертикальный степпер с соединителем */}
        <div className="lvl-ladder">
          {LEVELS.map((l, i) => {
            const reached = points >= l.min
            const isCurrent = i === prog.idx
            const linkOn = i + 1 < LEVELS.length && points >= LEVELS[i + 1].min
            return (
              <div key={l.name} className={`lvl-step${isCurrent ? ' is-current' : ''}${linkOn ? ' lvl-step--link' : ''}`}>
                <span className={`lvl-step__badge${reached ? ' is-reached' : ''}`} aria-hidden>
                  {reached ? <Check size={14} /> : i + 1}
                </span>
                <div className="lvl-step__body">
                  <div className="lvl-step__title">
                    <span className={`lvl-step__name${reached ? ' is-reached' : ''}${isCurrent ? ' is-current' : ''}`}>{l.name}</span>
                    <span className="lvl-step__pts">· {l.min} очков</span>
                    {isCurrent && <span className="lvl-step__here">вы здесь</span>}
                  </div>
                  <div className="lvl-step__perk">{PERKS[i]}</div>
                </div>
              </div>
            )
          })}
        </div>

        {!hasPaid && (
          <div style={{ marginTop: 12, paddingTop: 16, borderTop: '1px solid var(--brand-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
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

      {badges.length > 0 && (
        <div className="c-card" style={{ padding: 20, marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--brand-text)', marginBottom: 10 }}>Значки</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {badges.map((b) => (
              <span key={b.id} title={b.desc} style={{ fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 999, color: b.exclusive ? 'var(--brand-accent)' : 'var(--brand-text)', background: b.exclusive ? 'color-mix(in srgb, var(--brand-accent) 14%, transparent)' : 'color-mix(in srgb, var(--brand-text) 8%, transparent)' }}>
                {b.name}
              </span>
            ))}
          </div>
        </div>
      )}

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
