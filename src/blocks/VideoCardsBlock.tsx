import React from 'react'
import { Play, Lock } from 'lucide-react'
import { HoverPreviewImage } from '@/components/HoverPreviewImage'
import type { SeriesEpisode } from './VideoSeriesBlock'

function fmtDur(sec: number | null): string | null {
  if (!sec || sec <= 0) return null
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

/**
 * Одиночные видео раздела — горизонтальные карточки 16:9 (обычная видео-лента).
 * Клик по карточке ведёт на страницу просмотра /video/<slug>. Используется в
 * обычном разделе, когда «Видео в разделе = Одиночные». Если видео одно —
 * карточка крупнее (класс is-single).
 */
export function VideoCardsBlock({ episodes, heading }: { episodes: SeriesEpisode[]; heading?: string }) {
  if (!episodes || episodes.length === 0) return null
  const single = episodes.length === 1
  return (
    <section className="vcards-wrap">
      {heading && <h2 className="vcards-heading">{heading}</h2>}
      <div className={'vcards' + (single ? ' is-single' : '')}>
        {episodes.map((v) => {
          const dur = fmtDur(v.durationSec)
          return (
            <a key={v.id} href={`/video/${v.slug}`} className="vcard" title={v.title}>
              <div className="vcard__frame">
                {v.coverUrl ? (
                  <HoverPreviewImage poster={v.coverUrl} gif={v.previewGif ?? null} alt={v.title} sizes="(max-width: 640px) 100vw, 33vw" />
                ) : (
                  <div className="vcard__ph" aria-hidden><Play size={28} /></div>
                )}
                <span className="vcard__play" aria-hidden><Play size={22} /></span>
                {dur && <span className="vcard__dur">{dur}</span>}
                {!v.isFree && (
                  <span className="vcard__lock" title={v.minTierName ? `Доступ: ${v.minTierName}` : 'По подписке'}>
                    <Lock size={12} /> {v.minTierName || 'Подписка'}
                  </span>
                )}
              </div>
              <div className="vcard__title">{v.title}</div>
            </a>
          )
        })}
      </div>
    </section>
  )
}
