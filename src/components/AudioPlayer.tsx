'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Play, Pause, RotateCcw, RotateCw, Volume2, VolumeX } from 'lucide-react'

const RATES = [1, 1.25, 1.5, 1.75, 2]

function fmt(s: number): string {
  if (!isFinite(s) || s < 0) s = 0
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = Math.floor(s % 60)
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m)
  return (h > 0 ? `${h}:` : '') + `${mm}:${String(sec).padStart(2, '0')}`
}

function hashStr(str: string): number {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
function mulberry32(a: number): () => number {
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
/** Псевдо-форма волны: стабильный по seed набор из `count` высот [0.12..1]. */
function buildWave(seed: number, count: number): number[] {
  const rnd = mulberry32(seed)
  const out: number[] = []
  for (let i = 0; i < count; i++) {
    const env = 0.55 + 0.45 * Math.sin((i / count) * Math.PI)
    const wobble = 0.5 + 0.5 * Math.sin(i * 0.5 + (seed % 7))
    const h = (0.35 * rnd() + 0.35 * wobble + 0.3 * rnd()) * env
    out.push(Math.max(0.12, Math.min(1, h)))
  }
  return out
}

/**
 * Аудиоплеер в духе SoundCloud: крупная кнопка + волновая дорожка (клик =
 * перемотка), время, скорость, громкость. Число полос волны адаптируется к
 * ширине (ResizeObserver) — на мобильном не распирает вёрстку. Форма —
 * синтетическая, стабильная на трек. Стили — брендовые токены, обе темы.
 */
export function AudioPlayer({ src, onEnded, autoPlay }: { src: string; onEnded?: () => void; autoPlay?: boolean }) {
  const ref = useRef<HTMLAudioElement>(null)
  const waveRef = useRef<HTMLDivElement>(null)
  const [playing, setPlaying] = useState(false)
  const [cur, setCur] = useState(0)
  const [dur, setDur] = useState(0)
  const [rate, setRate] = useState(1)
  const [muted, setMuted] = useState(false)
  const [vol, setVol] = useState(1)
  const [hover, setHover] = useState<number | null>(null)
  const [barCount, setBarCount] = useState(72)

  // Адаптивное число полос: ~1 полоса на 5px ширины, в пределах [28..160].
  useEffect(() => {
    const el = waveRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width || 0
      const n = Math.max(28, Math.min(160, Math.floor(w / 5)))
      setBarCount(n)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const wave = useMemo(() => buildWave(hashStr(src || 'a'), barCount), [src, barCount])

  useEffect(() => {
    setCur(0)
    setDur(0)
    setPlaying(false)
    setHover(null)
  }, [src])

  useEffect(() => {
    if (!autoPlay) return
    const a = ref.current
    if (a) {
      const p = a.play()
      if (p) p.catch(() => {})
    }
  }, [src, autoPlay])

  const progress = dur > 0 ? cur / dur : 0

  function toggle() {
    const a = ref.current
    if (!a) return
    if (a.paused) {
      const p = a.play()
      if (p) p.catch(() => {})
    } else {
      a.pause()
    }
  }
  function seekFrac(f: number) {
    const a = ref.current
    if (!a || !(a.duration > 0)) return
    const t = Math.max(0, Math.min(1, f)) * a.duration
    a.currentTime = t
    setCur(t)
  }
  function fracFromEvent(clientX: number): number {
    const el = waveRef.current
    if (!el) return 0
    const r = el.getBoundingClientRect()
    return (clientX - r.left) / r.width
  }
  function skip(d: number) {
    const a = ref.current
    if (!a) return
    a.currentTime = Math.max(0, Math.min(a.duration || 0, a.currentTime + d))
    setCur(a.currentTime)
  }
  function cycleRate() {
    const next = RATES[(RATES.indexOf(rate) + 1) % RATES.length]
    setRate(next)
    if (ref.current) ref.current.playbackRate = next
  }
  function toggleMute() {
    const a = ref.current
    if (!a) return
    a.muted = !a.muted
    setMuted(a.muted)
  }
  function changeVol(v: number) {
    const a = ref.current
    if (!a) return
    a.volume = v
    a.muted = v === 0
    setVol(v)
    setMuted(v === 0)
  }

  const iconBtn: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: 38, height: 38, borderRadius: 11, border: '1px solid var(--brand-border)',
    background: 'transparent', color: 'var(--brand-text)', cursor: 'pointer', flex: 'none',
  }

  return (
    <div style={{ background: 'var(--brand-surface)', border: '1px solid var(--brand-border)', borderRadius: 16, padding: 16, maxWidth: '100%', overflow: 'hidden' }}>
      <style>{`
        .audpl-range{ -webkit-appearance:none; appearance:none; height:6px; border-radius:999px; outline:none; cursor:pointer; }
        .audpl-range::-webkit-slider-thumb{ -webkit-appearance:none; appearance:none; width:14px; height:14px; border-radius:999px; background:var(--brand-primary); box-shadow:0 1px 4px rgba(0,0,0,.3); cursor:pointer; }
        .audpl-range::-moz-range-thumb{ width:14px; height:14px; border:none; border-radius:999px; background:var(--brand-primary); cursor:pointer; }
        .audpl-bar{ flex:1 1 0; min-width:0; border-radius:2px; transition:background-color .12s linear; }
      `}</style>

      <audio
        ref={ref}
        src={src}
        preload="metadata"
        onLoadedMetadata={() => setDur(ref.current?.duration || 0)}
        onTimeUpdate={() => setCur(ref.current?.currentTime || 0)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false)
          onEnded?.()
        }}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        <button
          onClick={toggle}
          title={playing ? 'Пауза' : 'Играть'}
          style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 52, height: 52, borderRadius: 999, border: 'none', background: 'var(--brand-primary)', color: '#fff', cursor: 'pointer' }}
        >
          {playing ? <Pause size={23} fill="currentColor" /> : <Play size={23} fill="currentColor" style={{ marginLeft: 3 }} />}
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            ref={waveRef}
            onClick={(e) => seekFrac(fracFromEvent(e.clientX))}
            onMouseMove={(e) => setHover(fracFromEvent(e.clientX))}
            onMouseLeave={() => setHover(null)}
            style={{ display: 'flex', alignItems: 'center', gap: 2, height: 50, cursor: 'pointer', minWidth: 0, overflow: 'hidden' }}
            role="slider"
            aria-label="Перемотка"
            aria-valuemin={0}
            aria-valuemax={Math.round(dur)}
            aria-valuenow={Math.round(cur)}
          >
            {wave.map((h, i) => {
              const frac = (i + 0.5) / wave.length
              const played = frac <= progress
              const scrub = hover != null && !played && frac <= hover
              const bg = played
                ? 'var(--brand-primary)'
                : scrub
                  ? 'color-mix(in srgb, var(--brand-primary) 45%, transparent)'
                  : 'color-mix(in srgb, var(--brand-text) 20%, transparent)'
              return <span key={i} className="audpl-bar" style={{ height: `${Math.round(h * 100)}%`, background: bg }} />
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--brand-muted)', fontVariantNumeric: 'tabular-nums', marginTop: 6 }}>
            <span>{fmt(cur)}</span>
            <span>{fmt(dur)}</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        <button onClick={() => skip(-15)} title="Назад 15 секунд" style={iconBtn}>
          <RotateCcw size={16} />
          <span style={{ fontSize: 9, fontWeight: 700, marginLeft: -2 }}>15</span>
        </button>
        <button onClick={() => skip(15)} title="Вперёд 15 секунд" style={iconBtn}>
          <span style={{ fontSize: 9, fontWeight: 700, marginRight: -2 }}>15</span>
          <RotateCw size={16} />
        </button>

        <div style={{ flex: 1, minWidth: 8 }} />

        <button onClick={cycleRate} title="Скорость воспроизведения" style={{ ...iconBtn, width: 'auto', padding: '0 12px', fontWeight: 700, fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
          {rate}×
        </button>
        <button onClick={toggleMute} title={muted ? 'Включить звук' : 'Выключить звук'} style={iconBtn}>
          {muted || vol === 0 ? <VolumeX size={17} /> : <Volume2 size={17} />}
        </button>
        <input
          className="audpl-range"
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={muted ? 0 : vol}
          onChange={(e) => changeVol(Number(e.target.value))}
          style={{ width: 72, flex: 'none', background: `linear-gradient(to right, var(--brand-primary) ${(muted ? 0 : vol) * 100}%, color-mix(in srgb, var(--brand-text) 14%, transparent) ${(muted ? 0 : vol) * 100}%)` }}
          aria-label="Громкость"
        />
      </div>
    </div>
  )
}
