'use client'

import React, { useEffect, useState } from 'react'
import Link from '@/components/AppLink'
import { Radio, ArrowRight } from 'lucide-react'

/**
 * Баннер трансляции на главной (в Hero-зоне). Показывает ближайшую/текущую
 * трансляцию: до старта — «Скоро в эфире» + обратный отсчёт, в окне — «В эфире».
 * Промо для всех (пейволл применяется уже на странице трансляции). После
 * окончания — прячется. Статус — по времени, с живым обновлением.
 */
export function StreamHeroBanner({
  title,
  slug,
  scheduledAt,
  endsAt,
  coverUrl,
  tierName,
}: {
  title: string
  slug: string
  scheduledAt: string | null
  endsAt: string | null
  coverUrl: string | null
  tierName: string | null
}) {
  const [mounted, setMounted] = useState(false)
  const [now, setNow] = useState(0)
  useEffect(() => {
    setMounted(true)
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const start = scheduledAt ? Date.parse(scheduledAt) : 0
  const end = endsAt ? Date.parse(endsAt) : 0
  const phase = !mounted ? 'soon' : !start || now < start ? 'soon' : end && now >= end ? 'ended' : 'live'

  if (mounted && phase === 'ended') return null

  const live = phase === 'live'
  const subtitle = !mounted
    ? ''
    : live
      ? 'Идёт прямой эфир'
      : start
        ? `Начало через ${fmtLeft(start - now)}`
        : ''
  const when = start ? new Date(start).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : ''

  return (
    <Link
      href={`/stream/${slug}`}
      prefetch={false}
      style={{ display: 'block', textDecoration: 'none', marginBottom: 20 }}
    >
      <div
        style={{
          position: 'relative',
          borderRadius: 18,
          overflow: 'hidden',
          minHeight: 180,
          border: '1px solid var(--brand-border, rgba(0,0,0,.12))',
        }}
      >
        {coverUrl && <div style={{ position: 'absolute', inset: 0, background: `url(${coverUrl}) center/cover`, filter: 'brightness(.42)' }} />}
        {!coverUrl && <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, color-mix(in srgb, var(--brand-primary, #ea580c) 40%, #000), #000)' }} />}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(0,0,0,.55), rgba(0,0,0,.15))' }} />

        <div style={{ position: 'relative', padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 10, minHeight: 180, justifyContent: 'center' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, alignSelf: 'flex-start', padding: '5px 12px', borderRadius: 999, fontWeight: 800, fontSize: 12.5, letterSpacing: '.02em', color: '#fff', background: live ? '#dc2626' : 'color-mix(in srgb, var(--brand-primary, #ea580c) 85%, transparent)' }}>
            {live ? (
              <>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff', animation: 'cb-hero-pulse 1.4s ease-out infinite' }} />
                В ЭФИРЕ
              </>
            ) : (
              <>
                <Radio size={14} /> СКОРО В ЭФИРЕ
              </>
            )}
          </div>

          <div style={{ fontSize: 24, fontWeight: 800, color: '#fff', lineHeight: 1.15, textShadow: '0 2px 8px rgba(0,0,0,.5)' }}>{title}</div>

          {subtitle && <div style={{ color: 'rgba(255,255,255,.9)', fontSize: 15, fontVariantNumeric: 'tabular-nums' }}>{subtitle}{when && !live ? ` · ${when}` : ''}</div>}

          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, alignSelf: 'flex-start', marginTop: 4, padding: '10px 18px', borderRadius: 999, background: 'var(--brand-primary, #ea580c)', color: '#fff', fontWeight: 700, fontSize: 14 }}>
            {live ? 'Смотреть' : 'Подробнее'} <ArrowRight size={16} />
          </div>

          {tierName && <div style={{ color: 'rgba(255,255,255,.7)', fontSize: 12.5 }}>По подписке «{tierName}» и выше</div>}
        </div>
      </div>
      <style>{`@keyframes cb-hero-pulse{0%{box-shadow:0 0 0 0 rgba(255,255,255,.7)}70%{box-shadow:0 0 0 7px rgba(255,255,255,0)}100%{box-shadow:0 0 0 0 rgba(255,255,255,0)}}`}</style>
    </Link>
  )
}

function fmtLeft(ms: number): string {
  if (ms <= 0) return 'меньше минуты'
  const s = Math.floor(ms / 1000)
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = s % 60
  const p = (n: number) => String(n).padStart(2, '0')
  if (d > 0) return `${d} дн ${p(h)}:${p(m)}:${p(ss)}`
  return `${p(h)}:${p(m)}:${p(ss)}`
}
