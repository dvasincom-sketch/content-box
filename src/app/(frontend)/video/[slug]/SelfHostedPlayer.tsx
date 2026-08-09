'use client'

import React, { useEffect, useRef, useState } from 'react'

/**
 * Плеер собственного HLS-видео (provider='self'). Safari играет HLS нативно,
 * остальным подгружаем hls.js (динамический импорт — не тянем в общий бандл).
 * master уже содержит ?t=<JWT>; дочерние URI приходят с токеном из /api/hls,
 * поэтому кастомный loader не нужен.
 *
 * watermarkText — каркас под динамический водяной знак (Фаза 2): если передан,
 * поверх видео плавает полупрозрачная подпись (email/IP зрителя).
 */
const WM_POSITIONS: React.CSSProperties[] = [
  { top: 12, left: 12 },
  { top: 12, right: 12 },
  { bottom: 48, right: 12 },
  { bottom: 48, left: 12 },
]

export function SelfHostedPlayer({
  master,
  poster,
  watermarkText,
}: {
  master: string
  poster?: string | null
  watermarkText?: string | null
}) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    let hls: { destroy: () => void } | null = null
    let cancelled = false

    // Нативный HLS (Safari / iOS).
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = master
      return () => { video.removeAttribute('src'); video.load() }
    }

    import('hls.js')
      .then(({ default: Hls }) => {
        if (cancelled) return
        if (Hls.isSupported()) {
          const inst = new Hls({ enableWorker: true, lowLatencyMode: false, backBufferLength: 30 })
          inst.loadSource(master)
          inst.attachMedia(video)
          hls = inst
        } else {
          video.src = master
        }
      })
      .catch(() => { video.src = master })

    return () => {
      cancelled = true
      if (hls) hls.destroy()
    }
  }, [master])

  // Watermark медленно меняет позицию (раз в ~7с) — так его труднее закрыть
  // или обрезать при записи экрана. 4 угла по кругу.
  const [wmPos, setWmPos] = useState(0)
  useEffect(() => {
    if (!watermarkText) return
    const id = setInterval(() => setWmPos((p) => (p + 1) % WM_POSITIONS.length), 7000)
    return () => clearInterval(id)
  }, [watermarkText])

  return (
    <>
      <video
        ref={videoRef}
        poster={poster || undefined}
        controls
        playsInline
        controlsList="nodownload"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', background: '#000' }}
      />
      {watermarkText ? (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            padding: '2px 8px',
            fontSize: 11,
            color: 'rgba(255,255,255,.5)',
            background: 'rgba(0,0,0,.22)',
            borderRadius: 6,
            pointerEvents: 'none',
            userSelect: 'none',
            transition: 'top .8s ease, left .8s ease, right .8s ease, bottom .8s ease',
            ...WM_POSITIONS[wmPos],
          }}
        >
          {watermarkText}
        </div>
      ) : null}
    </>
  )
}
