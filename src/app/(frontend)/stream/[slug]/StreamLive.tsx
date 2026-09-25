'use client'

import React, { useEffect, useState } from 'react'

/**
 * Клиентская часть страницы трансляции: статус ПО ВРЕМЕНИ (Скоро / В эфире /
 * Завершена) с обратным отсчётом и авто-переключением, без перезагрузки.
 * Доступ проверяется на сервере — этот компонент рендерится только тем, у кого
 * есть доступ.
 */
export function StreamLive({
  title,
  scheduledAt,
  endsAt,
  playbackUrl,
  recordingUrl,
  coverUrl,
}: {
  title: string
  scheduledAt: string | null
  endsAt: string | null
  playbackUrl: string
  recordingUrl: string
  coverUrl: string | null
}) {
  const [mounted, setMounted] = useState(false)
  const [now, setNow] = useState(0)
  useEffect(() => {
    setMounted(true)
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  // До монтирования — нейтральная заглушка (без несовпадения гидрации).
  if (!mounted) return <Frame coverUrl={coverUrl} title={title} />

  const start = scheduledAt ? Date.parse(scheduledAt) : 0
  const end = endsAt ? Date.parse(endsAt) : 0
  const phase = !start || now < start ? 'soon' : end && now >= end ? 'ended' : 'live'

  if (phase === 'live') {
    return playbackUrl ? (
      <div>
        <Chip color="#dc2626" label="В эфире" pulse />
        <Player src={playbackUrl} />
      </div>
    ) : (
      <Frame coverUrl={coverUrl} title="Скоро" subtitle="Ссылка трансляции ещё не задана автором." />
    )
  }

  if (phase === 'ended') {
    return recordingUrl ? (
      <div>
        <Chip color="var(--brand-primary, #ea580c)" label="Повтор эфира" />
        <Player src={recordingUrl} />
      </div>
    ) : (
      <Frame coverUrl={coverUrl} title="Эфир завершён" subtitle="Записи нет." />
    )
  }

  // soon
  const left = start - now
  return (
    <Frame
      coverUrl={coverUrl}
      title="Скоро в эфире"
      subtitle={`Начало через ${fmtLeft(left)}`}
      extra={start ? new Date(start).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : ''}
    />
  )
}

function fmtLeft(ms: number): string {
  if (ms <= 0) return '0:00'
  const s = Math.floor(ms / 1000)
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = s % 60
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d > 0 ? d + ' дн ' : ''}${p(h)}:${p(m)}:${p(ss)}`
}

function Player({ src }: { src: string }) {
  return (
    <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', borderRadius: 16, overflow: 'hidden', background: '#000' }}>
      <iframe
        src={src}
        allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
        allowFullScreen
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
      />
    </div>
  )
}

function Frame({ coverUrl, title, subtitle, extra }: { coverUrl: string | null; title: string; subtitle?: string; extra?: string }) {
  return (
    <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', borderRadius: 16, overflow: 'hidden', border: '1px solid var(--brand-border, rgba(0,0,0,.12))' }}>
      {coverUrl && <div style={{ position: 'absolute', inset: 0, background: `url(${coverUrl}) center/cover`, filter: 'brightness(.55)' }} />}
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center', padding: 24, background: 'color-mix(in srgb, #000 35%, transparent)' }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 6 }}>{title}</div>
          {subtitle && <div style={{ color: 'rgba(255,255,255,.92)', fontVariantNumeric: 'tabular-nums', fontSize: 16 }}>{subtitle}</div>}
          {extra && <div style={{ color: 'rgba(255,255,255,.6)', fontSize: 13, marginTop: 6 }}>{extra}</div>}
        </div>
      </div>
    </div>
  )
}

function Chip({ color, label, pulse }: { color: string; label: string; pulse?: boolean }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, marginBottom: 10, padding: '5px 12px', borderRadius: 999, background: 'color-mix(in srgb, ' + color + ' 14%, transparent)', color, fontWeight: 700, fontSize: 13 }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, animation: pulse ? 'cb-live-pulse 1.4s ease-out infinite' : undefined }} />
      {label}
      <style>{`@keyframes cb-live-pulse{0%{box-shadow:0 0 0 0 ${'color-mix(in srgb,' + color + ' 60%,transparent)'}}70%{box-shadow:0 0 0 7px transparent}100%{box-shadow:0 0 0 0 transparent}}`}</style>
    </div>
  )
}
