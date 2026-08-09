'use client'

import React, { useEffect, useRef } from 'react'

/**
 * Плеер собственного HLS-видео (provider='self'). Safari играет HLS нативно,
 * остальным подгружаем hls.js (динамический импорт — не тянем в общий бандл).
 * master уже содержит ?t=<JWT>; дочерние URI приходят с токеном из /api/hls,
 * поэтому кастомный loader не нужен.
 *
 * watermarkText — каркас под динамический водяной знак (Фаза 2): если передан,
 * поверх видео плавает полупрозрачная подпись (email/IP зрителя).
 */
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
            right: 12,
            bottom: 48,
            padding: '2px 8px',
            fontSize: 11,
            color: 'rgba(255,255,255,.55)',
            background: 'rgba(0,0,0,.25)',
            borderRadius: 6,
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        >
          {watermarkText}
        </div>
      ) : null}
    </>
  )
}
