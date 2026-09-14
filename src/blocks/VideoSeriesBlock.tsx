'use client'

import React, { useMemo, useState } from 'react'
import { Play, Lock, Clock } from 'lucide-react'
import { VideoPlayer } from '@/app/(frontend)/video/[slug]/VideoPlayer'
import { formatDuration } from '@/lib/formatDuration'

/**
 * Видео-плейлист (эпизоды) — YouTube-подобная раскладка для категории с флагом
 * videoSeries. Слева плеер выбранного эпизода, справа список серий по порядку
 * поля «Эпизод». Плеер — тот же VideoPlayer, что и на странице видео: он сам
 * проверяет доступ по подписке (через /api/video-token) и показывает ошибку,
 * если у зрителя нет нужного уровня. Здесь мы лишь помечаем платные серии
 * «замком» для наглядности.
 *
 * Сезоны как отдельная сущность убраны намеренно: разные сезоны заводятся
 * отдельными категориями (подразделами), а не полем у каждого видео.
 */

export type SeriesEpisode = {
  id: number | string
  title: string
  slug: string
  coverUrl: string | null
  previewGif?: string | null
  episode: number | null
  durationSec: number | null
  isFree: boolean
  minTierName: string | null
}

const fmtDur = formatDuration

/** Порядок серий: по номеру эпизода, затем по названию. */
function sortEpisodes(episodes: SeriesEpisode[]): SeriesEpisode[] {
  return [...episodes].sort((a, b) => {
    const ea = a.episode == null ? Number.POSITIVE_INFINITY : a.episode
    const eb = b.episode == null ? Number.POSITIVE_INFINITY : b.episode
    if (ea !== eb) return ea - eb
    return a.title.localeCompare(b.title, 'ru')
  })
}

export function VideoSeriesBlock({
  episodes,
  seriesCoverUrl = null,
}: {
  episodes: SeriesEpisode[]
  /** Обложка категории — фолбэк-превью для серий без своей обложки. */
  seriesCoverUrl?: string | null
}) {
  const ordered = useMemo(() => sortEpisodes(episodes), [episodes])

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [autoplay, setAutoplay] = useState(false)

  if (episodes.length === 0) {
    return (
      <p style={{ color: 'var(--brand-muted)' }}>В этом плейлисте пока нет видео.</p>
    )
  }

  const selected = ordered.find((e) => String(e.id) === selectedId) ?? ordered[0]

  // Сквозной порядок для кнопок «предыдущая/следующая».
  const curIdx = ordered.findIndex((e) => String(e.id) === String(selected.id))
  const hasPrev = curIdx > 0
  const hasNext = curIdx >= 0 && curIdx < ordered.length - 1

  const selectEpisode = (ep: SeriesEpisode, auto: boolean) => {
    setSelectedId(String(ep.id))
    setAutoplay(auto)
  }
  const goNext = () => { if (hasNext) selectEpisode(ordered[curIdx + 1], true) }
  const goPrev = () => { if (hasPrev) selectEpisode(ordered[curIdx - 1], true) }

  return (
    // Обёртка-контейнер: раскладка .vseries переключается по ШИРИНЕ КОНТЕЙНЕРА
    // (container query), а не по ширине окна. Иначе в узкой колонке публикации
    // (max-w-3xl) двухколоночная сетка не помещалась: плеер сжимался и появлялась
    // горизонтальная прокрутка. На широкой странице раздела остаётся 2 колонки.
    <div className="vseries-wrap">
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
        <ol className="vseries__episodes">
          {ordered.map((ep) => {
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
    </div>
  )
}
