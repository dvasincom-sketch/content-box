'use client'

import React, { useMemo, useState } from 'react'
import { Play, Lock, Clock } from 'lucide-react'
import { VideoPlayer } from '@/app/(frontend)/video/[slug]/VideoPlayer'

/**
 * Видео-плейлист (сезоны/эпизоды) — YouTube-подобная раскладка для категории с
 * флагом videoSeries. Слева плеер выбранного эпизода, справа список серий с
 * табами сезонов. Плеер — тот же VideoPlayer, что и на странице видео: он сам
 * проверяет доступ по подписке (через /api/video-token) и показывает ошибку,
 * если у зрителя нет нужного уровня. Здесь мы лишь помечаем платные серии
 * «замком» для наглядности.
 */

export type SeriesEpisode = {
  id: number | string
  title: string
  slug: string
  coverUrl: string | null
  previewGif?: string | null
  season: number | null
  episode: number | null
  durationSec: number | null
  isFree: boolean
  minTierName: string | null
}

type Season = { key: string; label: string; order: number; episodes: SeriesEpisode[] }

function fmtDur(sec: number | null): string {
  if (!sec) return ''
  const m = Math.floor(sec / 60)
  const s = Math.round(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

function groupSeasons(episodes: SeriesEpisode[]): Season[] {
  const map = new Map<string, Season>()
  for (const ep of episodes) {
    const key = ep.season == null ? 'none' : `s${ep.season}`
    if (!map.has(key)) {
      map.set(key, {
        key,
        label: ep.season == null ? 'Серии' : `Сезон ${ep.season}`,
        order: ep.season == null ? Number.POSITIVE_INFINITY : ep.season,
        episodes: [],
      })
    }
    map.get(key)!.episodes.push(ep)
  }
  const seasons = Array.from(map.values())
  seasons.sort((a, b) => a.order - b.order)
  for (const s of seasons) {
    s.episodes.sort((a, b) => {
      const ea = a.episode == null ? Number.POSITIVE_INFINITY : a.episode
      const eb = b.episode == null ? Number.POSITIVE_INFINITY : b.episode
      if (ea !== eb) return ea - eb
      return a.title.localeCompare(b.title, 'ru')
    })
  }
  return seasons
}

export function VideoSeriesBlock({
  episodes,
  seriesCoverUrl = null,
}: {
  episodes: SeriesEpisode[]
  /** Обложка категории — фолбэк-превью для серий без своей обложки. */
  seriesCoverUrl?: string | null
}) {
  const seasons = useMemo(() => groupSeasons(episodes), [episodes])

  const [seasonKey, setSeasonKey] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [autoplay, setAutoplay] = useState(false)

  if (episodes.length === 0) {
    return (
      <p style={{ color: 'var(--brand-muted)' }}>В этом плейлисте пока нет видео.</p>
    )
  }

  const activeSeason = seasons.find((s) => s.key === seasonKey) ?? seasons[0]
  const selected =
    episodes.find((e) => String(e.id) === selectedId) ?? activeSeason.episodes[0]

  // Плоский порядок всех серий (сезоны по порядку, внутри — по эпизодам) —
  // для сквозного перехода и кнопок «предыдущая/следующая», в т.ч. между сезонами.
  const flat = seasons.flatMap((s) => s.episodes)
  const curIdx = flat.findIndex((e) => String(e.id) === String(selected.id))
  const hasPrev = curIdx > 0
  const hasNext = curIdx >= 0 && curIdx < flat.length - 1

  // Выбрать серию: подсвечиваем её сезон (таб/список переключаются сами).
  const selectEpisode = (ep: SeriesEpisode, auto: boolean) => {
    setSelectedId(String(ep.id))
    setSeasonKey(ep.season == null ? 'none' : `s${ep.season}`)
    setAutoplay(auto)
  }

  const selectSeason = (s: Season) => selectEpisode(s.episodes[0], false)
  const goNext = () => { if (hasNext) selectEpisode(flat[curIdx + 1], true) }
  const goPrev = () => { if (hasPrev) selectEpisode(flat[curIdx - 1], true) }

  return (
    <div className="vseries">
      <div className="vseries__main">
        {/* key заставляет плеер перемонтироваться и заново запросить токен */}
        <VideoPlayer
          key={String(selected.id)}
          videoId={selected.id}
          onEnded={goNext}
          autoPlay={autoplay}
          onPrev={goPrev}
          onNext={goNext}
          hasPrev={hasPrev}
          hasNext={hasNext}
        />

        <h2 className="vseries__now-title">{selected.title}</h2>
        <div className="vseries__now-meta">
          {selected.season != null && (
            <span>Сезон {selected.season}</span>
          )}
          {selected.episode != null && (
            <span>Серия {selected.episode}</span>
          )}
          {fmtDur(selected.durationSec) && (
            <span className="vseries__now-dur">
              <Clock size={13} /> {fmtDur(selected.durationSec)}
            </span>
          )}
          {!selected.isFree && (
            <span className="vseries__badge">
              <Lock size={12} /> {selected.minTierName || 'По подписке'}
            </span>
          )}
        </div>
      </div>

      <aside className="vseries__side">
        {seasons.length > 1 && (
          <div className="vseries__seasons" role="tablist">
            {seasons.map((s) => (
              <button
                key={s.key}
                type="button"
                role="tab"
                aria-selected={s.key === activeSeason.key}
                className={`vseries__season-tab${s.key === activeSeason.key ? ' is-on' : ''}`}
                onClick={() => selectSeason(s)}
              >
                {s.label}
              </button>
            ))}
          </div>
        )}

        <ol className="vseries__episodes">
          {activeSeason.episodes.map((ep, i) => {
            const isActive = String(ep.id) === String(selected.id)
            const thumb = ep.coverUrl || seriesCoverUrl
            const usingFallback = !ep.coverUrl
            return (
              <li key={ep.id}>
                <button
                  type="button"
                  className={`vseries__ep${isActive ? ' is-active' : ''}`}
                  onClick={() => selectEpisode(ep, true)}
                >
                  <span className="vseries__ep-thumb">
                    {thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={thumb}
                        alt=""
                        loading="lazy"
                        className={usingFallback ? 'is-fallback' : undefined}
                      />
                    ) : (
                      // Ни своей обложки, ни обложки категории — брендовая заглушка.
                      <span className="vseries__ep-ph" aria-hidden>
                        <Play size={18} fill="currentColor" />
                      </span>
                    )}
                    {ep.previewGif && (
                      // Hover-превью: короткий gif проявляется при наведении на серию.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={ep.previewGif} alt="" aria-hidden loading="lazy" className="vseries__ep-gif" />
                    )}
                    {isActive && (
                      <span className="vseries__ep-playing" aria-hidden>
                        <Play size={16} fill="currentColor" />
                      </span>
                    )}
                    {!ep.isFree && (
                      <span className="vseries__ep-lock" aria-hidden>
                        <Lock size={12} />
                      </span>
                    )}
                  </span>
                  <span className="vseries__ep-body">
                    <span className="vseries__ep-title">{ep.title}</span>
                    <span className="vseries__ep-sub">
                      {ep.episode != null && <span>Серия {ep.episode}</span>}
                      {fmtDur(ep.durationSec) && <span>{fmtDur(ep.durationSec)}</span>}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
      </aside>
    </div>
  )
}
