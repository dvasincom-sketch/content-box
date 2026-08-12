'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Play, Pause, Maximize, Minimize, Volume2, VolumeX, Loader2, Captions, ListVideo, X } from 'lucide-react'

/**
 * Плеер собственного HLS-видео (provider='self') с кастомными контролами и
 * scrub-preview (превью кадра при наведении на таймлайн). Safari играет HLS
 * нативно, остальным подгружаем hls.js (динамический импорт).
 *
 * scrub-preview: воркер уже генерирует спрайт-лист + storyboard.vtt; сюда
 * приходит подписанный URL VTT (prop `sprite`). Парсим cue-таблицу (интервал →
 * storyboard.jpg#xywh) и при наведении на дорожку показываем нужный тайл.
 *
 * watermarkText — динамический водяной знак (email зрителя) поверх видео.
 */
const WM_POSITIONS: React.CSSProperties[] = [
  { top: 12, left: 12 },
  { top: 12, right: 12 },
  { bottom: 64, right: 12 },
  { bottom: 64, left: 12 },
]

type Cue = { start: number; end: number; img: string; x: number; y: number; w: number; h: number }

function parseTs(s: string): number {
  const m = s.trim().match(/(?:(\d+):)?(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?/)
  if (!m) return NaN
  const hh = m[1] ? parseInt(m[1], 10) : 0
  const mm = parseInt(m[2], 10)
  const ss = parseInt(m[3], 10)
  const ms = m[4] ? parseInt(m[4].padEnd(3, '0'), 10) : 0
  return hh * 3600 + mm * 60 + ss + ms / 1000
}

function parseVtt(text: string): Cue[] {
  const lines = text.replace(/\r/g, '').split('\n')
  const cues: Cue[] = []
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].includes('-->')) continue
    const [a, b] = lines[i].split('-->')
    const start = parseTs(a)
    const end = parseTs(b)
    let j = i + 1
    while (j < lines.length && lines[j].trim() === '') j++
    const payload = (lines[j] || '').trim()
    const hashIdx = payload.indexOf('#xywh=')
    if (hashIdx > 0 && Number.isFinite(start) && Number.isFinite(end)) {
      const img = payload.slice(0, hashIdx)
      const nums = payload.slice(hashIdx + 6).split(',').map((n) => parseInt(n, 10))
      if (img && nums.length === 4 && nums.every((n) => Number.isFinite(n))) {
        cues.push({ start, end, img, x: nums[0], y: nums[1], w: nums[2], h: nums[3] })
      }
    }
    i = j
  }
  return cues
}

function fmtTime(t: number): string {
  if (!Number.isFinite(t) || t < 0) t = 0
  const s = Math.floor(t % 60)
  const m = Math.floor(t / 60) % 60
  const h = Math.floor(t / 3600)
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}

export function SelfHostedPlayer({
  master,
  poster,
  watermarkText,
  sprite,
  subtitles,
  videoId,
  chapters: chapters_,
}: {
  master: string
  poster?: string | null
  watermarkText?: string | null
  sprite?: string | null
  subtitles?: { lang: string; label: string; url: string }[] | null
  videoId?: number | string | null
  chapters?: { start: number; title: string }[] | null
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const watchedRef = useRef<Set<number>>(new Set()) // все просмотренные слоты (для дедупа)
  const pendingRef = useRef<Set<number>>(new Set())  // новые слоты к отправке

  const [playing, setPlaying] = useState(false)
  const [current, setCurrent] = useState(0)
  const [duration, setDuration] = useState(0)
  const [buffered, setBuffered] = useState(0)
  const [muted, setMuted] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [ready, setReady] = useState(false)
  const [controlsShown, setControlsShown] = useState(true)
  const [cues, setCues] = useState<Cue[]>([])
  const [hover, setHover] = useState<{ ratio: number; time: number } | null>(null)
  const [activeTrack, setActiveTrack] = useState(-1) // -1 = субтитры выключены
  const [ccOpen, setCcOpen] = useState(false)
  const [chOpen, setChOpen] = useState(false)
  const [chHover, setChHover] = useState(-1)
  const chapters = Array.isArray(chapters_) ? chapters_ : []
  const tracks = Array.isArray(subtitles) ? subtitles : []

  // Применяем режим текстовых дорожек: показываем только активную.
  useEffect(() => {
    const v = videoRef.current
    if (!v || !v.textTracks) return
    for (let i = 0; i < v.textTracks.length; i++) {
      v.textTracks[i].mode = i === activeTrack ? 'showing' : 'disabled'
    }
  }, [activeTrack, tracks.length])

  /* ── HLS attach ──────────────────────────────────────────────────────── */
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    let hls: { destroy: () => void } | null = null
    let cancelled = false
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
    return () => { cancelled = true; if (hls) hls.destroy() }
  }, [master])

  /* ── Загрузка и парсинг сториборда ───────────────────────────────────── */
  useEffect(() => {
    if (!sprite) { setCues([]); return }
    let stop = false
    fetch(sprite, { credentials: 'include' })
      .then((r) => (r.ok ? r.text() : ''))
      .then((t) => { if (!stop && t) setCues(parseVtt(t)) })
      .catch(() => {})
    return () => { stop = true }
  }, [sprite])

  /* ── Синхронизация состояния с <video> ───────────────────────────────── */
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    const onTime = () => {
      setCurrent(v.currentTime)
      if (v.duration > 0) {
        const b = Math.min(99, Math.max(0, Math.floor((v.currentTime / v.duration) * 100)))
        if (!watchedRef.current.has(b)) { watchedRef.current.add(b); pendingRef.current.add(b) }
      }
    }
    const onDur = () => { setDuration(v.duration || 0); setReady(true) }
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    const onVol = () => setMuted(v.muted)
    const onProgress = () => {
      try { if (v.buffered.length) setBuffered(v.buffered.end(v.buffered.length - 1)) } catch { /* нет данных */ }
    }
    v.addEventListener('timeupdate', onTime)
    v.addEventListener('loadedmetadata', onDur)
    v.addEventListener('durationchange', onDur)
    v.addEventListener('play', onPlay)
    v.addEventListener('pause', onPause)
    v.addEventListener('volumechange', onVol)
    v.addEventListener('progress', onProgress)
    return () => {
      v.removeEventListener('timeupdate', onTime)
      v.removeEventListener('loadedmetadata', onDur)
      v.removeEventListener('durationchange', onDur)
      v.removeEventListener('play', onPlay)
      v.removeEventListener('pause', onPause)
      v.removeEventListener('volumechange', onVol)
      v.removeEventListener('progress', onProgress)
    }
  }, [])

  /* ── Аналитика удержания: beacon со слотами просмотра ────────────────── */
  useEffect(() => {
    if (!videoId) return
    const flush = () => {
      const b = Array.from(pendingRef.current)
      if (!b.length) return
      pendingRef.current.clear()
      try {
        const body = JSON.stringify({ videoId, buckets: b })
        navigator.sendBeacon?.('/api/video-heatmap', new Blob([body], { type: 'application/json' }))
      } catch { /* аналитика не критична */ }
    }
    const id = setInterval(flush, 10000)
    const onHide = () => flush()
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', onHide)
    const v = videoRef.current
    v?.addEventListener('pause', flush)
    v?.addEventListener('ended', flush)
    return () => {
      flush()
      clearInterval(id)
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', onHide)
      v?.removeEventListener('pause', flush)
      v?.removeEventListener('ended', flush)
    }
  }, [videoId])

  /* ── Fullscreen ──────────────────────────────────────────────────────── */
  useEffect(() => {
    const onFs = () => setFullscreen(document.fullscreenElement === containerRef.current)
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])

  const togglePlay = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    if (v.paused) v.play().catch(() => {})
    else v.pause()
  }, [])

  const toggleMute = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    v.muted = !v.muted
  }, [])

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    const vfs = videoRef.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null
    if (typeof el.requestFullscreen !== "function" && vfs?.webkitEnterFullscreen) { vfs.webkitEnterFullscreen(); return }
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    else el.requestFullscreen().catch(() => {})
  }, [])

  const seekTo = useCallback((time: number) => {
    const v = videoRef.current
    if (!v || !Number.isFinite(time)) return
    v.currentTime = Math.max(0, Math.min(time, v.duration || time))
  }, [])

  const ratioFromEvent = useCallback((clientX: number): number => {
    const el = trackRef.current
    if (!el) return 0
    const rect = el.getBoundingClientRect()
    return rect.width > 0 ? Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)) : 0
  }, [])

  /* ── Перетаскивание/клик по дорожке ──────────────────────────────────── */
  const onTrackPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    const r = ratioFromEvent(e.clientX)
    seekTo(r * (videoRef.current?.duration || 0))
    setHover({ ratio: r, time: r * (videoRef.current?.duration || 0) })
  }, [ratioFromEvent, seekTo])

  const onTrackPointerMove = useCallback((e: React.PointerEvent) => {
    const r = ratioFromEvent(e.clientX)
    const time = r * (videoRef.current?.duration || 0)
    setHover({ ratio: r, time })
    if (e.buttons === 1) seekTo(time)
  }, [ratioFromEvent, seekTo])

  const onTrackPointerLeave = useCallback(() => setHover(null), [])

  /* ── Автоскрытие контролов ───────────────────────────────────────────── */
  const poke = useCallback(() => {
    setControlsShown(true)
    if (hideTimer.current) clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) setControlsShown(false)
    }, 2600)
  }, [])

  useEffect(() => () => { if (hideTimer.current) clearTimeout(hideTimer.current) }, [])

  /* ── Клавиатура ──────────────────────────────────────────────────────── */
  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    const v = videoRef.current
    if (!v) return
    switch (e.key) {
      case ' ': case 'k': e.preventDefault(); togglePlay(); break
      case 'ArrowLeft': e.preventDefault(); seekTo(v.currentTime - 5); break
      case 'ArrowRight': e.preventDefault(); seekTo(v.currentTime + 5); break
      case 'f': e.preventDefault(); toggleFullscreen(); break
      case 'm': e.preventDefault(); toggleMute(); break
      default: return
    }
    poke()
  }, [togglePlay, seekTo, toggleFullscreen, toggleMute, poke])

  /* ── Превью-кадр под курсором ────────────────────────────────────────── */
  const hoverCue = useMemo(() => {
    if (!hover || !cues.length) return null
    return cues.find((c) => hover.time >= c.start && hover.time < c.end) || cues[cues.length - 1] || null
  }, [hover, cues])

  const curChapIdx = chapters.length ? chapters.reduce((acc, c, i) => (current >= c.start ? i : acc), -1) : -1
  const playedPct = duration > 0 ? (current / duration) * 100 : 0
  const bufferedPct = duration > 0 ? Math.min(100, (buffered / duration) * 100) : 0

  // Watermark медленно меняет позицию (антипиратство).
  const [wmPos, setWmPos] = useState(0)
  useEffect(() => {
    if (!watermarkText) return
    const id = setInterval(() => setWmPos((p) => (p + 1) % WM_POSITIONS.length), 7000)
    return () => clearInterval(id)
  }, [watermarkText])

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onPointerMove={poke}
      onMouseLeave={() => { if (videoRef.current && !videoRef.current.paused) setControlsShown(false) }}
      style={{ position: 'absolute', inset: 0, outline: 'none', background: '#000', cursor: controlsShown ? 'default' : 'none' }}
    >
      <video
        ref={videoRef}
        poster={poster || undefined}
        playsInline
        controlsList="nodownload"
        onClick={togglePlay}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', background: '#000' }}
      >
        {tracks.map((t, i) => (
          <track key={t.lang + i} kind="subtitles" srcLang={t.lang} label={t.label} src={t.url} />
        ))}
      </video>

      {/* Центральная кнопка Play при паузе */}
      {ready && !playing && (
        <button
          type="button"
          aria-label="Смотреть"
          onClick={togglePlay}
          style={{
            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            width: 72, height: 72, borderRadius: '50%', border: 'none', cursor: 'pointer',
            background: 'rgba(0,0,0,.55)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Play size={30} fill="#fff" style={{ marginLeft: 3 }} />
        </button>
      )}

      {!ready && (
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', color: 'rgba(255,255,255,.85)' }}>
          <Loader2 size={30} className="animate-spin" />
        </div>
      )}

      {/* Watermark */}
      {watermarkText ? (
        <div
          aria-hidden
          style={{
            position: 'absolute', padding: '2px 8px', fontSize: 11, color: 'rgba(255,255,255,.5)',
            background: 'rgba(0,0,0,.22)', borderRadius: 6, pointerEvents: 'none', userSelect: 'none',
            transition: 'top .8s ease, left .8s ease, right .8s ease, bottom .8s ease', ...WM_POSITIONS[wmPos],
          }}
        >
          {watermarkText}
        </div>
      ) : null}

      {/* Панель контролов */}
      <div
        style={{
          position: 'absolute', left: 0, right: 0, bottom: 0, padding: '24px 12px 10px',
          background: 'linear-gradient(to top, rgba(0,0,0,.6), transparent)',
          opacity: controlsShown ? 1 : 0, transition: 'opacity .2s ease',
          pointerEvents: controlsShown ? 'auto' : 'none',
        }}
      >
        {/* Дорожка + scrub-preview */}
        <div style={{ position: 'relative', padding: '8px 0' }}>
          {hover && (
            <div
              style={{
                position: 'absolute', bottom: 22, left: `${hover.ratio * 100}%`, transform: 'translateX(-50%)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, pointerEvents: 'none', zIndex: 2,
              }}
            >
              {hoverCue && (
                <div
                  style={{
                    width: hoverCue.w, height: hoverCue.h, borderRadius: 6, border: '2px solid rgba(255,255,255,.85)',
                    backgroundImage: `url("${hoverCue.img.split('#')[0]}")`,
                    backgroundPosition: `-${hoverCue.x}px -${hoverCue.y}px`, backgroundRepeat: 'no-repeat',
                    boxShadow: '0 4px 14px rgba(0,0,0,.5)',
                  }}
                />
              )}
              <span style={{ fontSize: 12, color: '#fff', background: 'rgba(0,0,0,.7)', padding: '1px 6px', borderRadius: 4 }}>
                {fmtTime(hover.time)}
              </span>
            </div>
          )}
          <div
            ref={trackRef}
            onPointerDown={onTrackPointerDown}
            onPointerMove={onTrackPointerMove}
            onPointerLeave={onTrackPointerLeave}
            style={{ position: 'relative', height: 6, borderRadius: 3, background: 'rgba(255,255,255,.25)', cursor: 'pointer', touchAction: 'none' }}
          >
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${bufferedPct}%`, background: 'rgba(255,255,255,.35)', borderRadius: 3 }} />
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${playedPct}%`, background: 'var(--brand-primary, #7c3aed)', borderRadius: 3 }} />
            <div style={{ position: 'absolute', left: `${playedPct}%`, top: '50%', transform: 'translate(-50%,-50%)', width: 12, height: 12, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,.5)' }} />
            {duration > 0 && chapters.map((c, i) => (c.start > 0 && c.start < duration ? (
              <div key={i} title={c.title} style={{ position: 'absolute', left: `${(c.start / duration) * 100}%`, top: -1, bottom: -1, width: 2, background: 'rgba(255,255,255,.75)', pointerEvents: 'none' }} />
            ) : null))}
          </div>
        </div>

        {/* Кнопки */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: '#fff' }}>
          <button type="button" aria-label={playing ? 'Пауза' : 'Смотреть'} onClick={togglePlay} style={btnStyle}>
            {playing ? <Pause size={20} fill="#fff" /> : <Play size={20} fill="#fff" />}
          </button>
          <button type="button" aria-label={muted ? 'Включить звук' : 'Выключить звук'} onClick={toggleMute} style={btnStyle}>
            {muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
          </button>
          <span style={{ fontSize: 13, fontVariantNumeric: 'tabular-nums', opacity: 0.9 }}>
            {fmtTime(current)} / {fmtTime(duration)}
          </span>
          {curChapIdx >= 0 && (
            <span style={{ fontSize: 12, opacity: 0.8, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>· {chapters[curChapIdx].title}</span>
          )}
          <span style={{ flex: 1 }} />
          {chapters.length > 0 && (
            <button type="button" aria-label="Таймкоды" onClick={() => setChOpen((o) => !o)} style={{ ...btnStyle, opacity: chOpen ? 1 : 0.85 }}>
              <ListVideo size={20} />
            </button>
          )}
          {tracks.length > 0 && (
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                aria-label="Субтитры"
                onClick={() => setCcOpen((o) => !o)}
                style={{ ...btnStyle, opacity: activeTrack >= 0 ? 1 : 0.7 }}
              >
                <Captions size={20} />
              </button>
              {ccOpen && (
                <div style={ccMenuStyle}>
                  <button type="button" onClick={() => { setActiveTrack(-1); setCcOpen(false) }} style={ccItemStyle(activeTrack === -1)}>Выкл</button>
                  {tracks.map((t, i) => (
                    <button key={t.lang + i} type="button" onClick={() => { setActiveTrack(i); setCcOpen(false) }} style={ccItemStyle(activeTrack === i)}>{t.label}</button>
                  ))}
                </div>
              )}
            </div>
          )}
          <button type="button" aria-label={fullscreen ? 'Свернуть' : 'На весь экран'} onClick={toggleFullscreen} style={btnStyle}>
            {fullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
          </button>
        </div>
      </div>

      {/* Панель таймкодов — правая половина плеера, на всю высоту, со скроллом */}
      {chapters.length > 0 && chOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute', top: 0, right: 0, bottom: 0, zIndex: 6,
            width: 'clamp(260px, 50%, 480px)',
            background: 'rgba(12,12,16,.86)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
            borderLeft: '1px solid rgba(255,255,255,.12)',
            display: 'flex', flexDirection: 'column',
          }}
        >
          <div style={{ flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 8px 12px 16px', borderBottom: '1px solid rgba(255,255,255,.1)' }}>
            <span style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>Таймкоды</span>
            <button type="button" aria-label="Закрыть" onClick={() => setChOpen(false)} style={{ ...btnStyle, padding: 6 }}>
              <X size={18} />
            </button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
            {chapters.map((c, i) => {
              const active = i === curChapIdx
              const hovered = i === chHover
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => seekTo(c.start)}
                  onMouseEnter={() => setChHover(i)}
                  onMouseLeave={() => setChHover((h) => (h === i ? -1 : h))}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 12, width: '100%', textAlign: 'left',
                    border: 'none', cursor: 'pointer', borderRadius: 8, padding: '10px 12px',
                    background: active ? 'rgba(255,255,255,.18)' : hovered ? 'rgba(255,255,255,.08)' : 'transparent',
                    color: '#fff', transition: 'background .15s ease',
                  }}
                >
                  <span style={{ flex: 'none', width: 52, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 13, color: active ? '#fff' : 'rgba(255,255,255,.6)', fontWeight: active ? 700 : 500, paddingTop: 1 }}>{fmtTime(c.start)}</span>
                  <span style={{ flex: 1, fontSize: 14, lineHeight: 1.4, fontWeight: active ? 600 : 400 }}>{c.title}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

const ccMenuStyle: React.CSSProperties = {
  position: 'absolute', bottom: 'calc(100% + 8px)', right: 0, minWidth: 120,
  background: 'rgba(20,20,24,.96)', borderRadius: 10, padding: 6,
  display: 'flex', flexDirection: 'column', gap: 2, boxShadow: '0 6px 20px rgba(0,0,0,.5)',
}
function ccItemStyle(active: boolean): React.CSSProperties {
  return {
    background: active ? 'rgba(255,255,255,.16)' : 'transparent', border: 'none', color: '#fff',
    fontSize: 13, textAlign: 'left', padding: '6px 10px', borderRadius: 6, cursor: 'pointer', whiteSpace: 'nowrap',
  }
}

const btnStyle: React.CSSProperties = {
  background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 4,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
}
