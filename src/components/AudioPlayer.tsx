'use client'

import React, { useEffect, useRef, useState } from 'react'
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

/**
 * Современный аудиоплеер (2026): своя разметка поверх скрытого <audio>.
 * Play/pause, перемотка слайдером с акцентной заливкой, ±15 сек, скорость,
 * громкость. Стили — брендовые токены, работает в светлой и тёмной теме.
 * Используется и на странице аудио, и в плейлисте (VideoSeriesBlock) через VideoPlayer.
 */
export function AudioPlayer({ src, onEnded }: { src: string; onEnded?: () => void }) {
  const ref = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [cur, setCur] = useState(0)
  const [dur, setDur] = useState(0)
  const [rate, setRate] = useState(1)
  const [muted, setMuted] = useState(false)
  const [vol, setVol] = useState(1)

  useEffect(() => {
    setCur(0)
    setDur(0)
    setPlaying(false)
  }, [src])

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
  function seek(v: number) {
    const a = ref.current
    if (a) {
      a.currentTime = v
      setCur(v)
    }
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

  const pct = dur > 0 ? (cur / dur) * 100 : 0
  const track = (p: number) =>
    `linear-gradient(to right, var(--brand-primary) ${p}%, color-mix(in srgb, var(--brand-text) 14%, transparent) ${p}%)`

  const iconBtn: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: 40, height: 40, borderRadius: 12, border: '1px solid var(--brand-border)',
    background: 'transparent', color: 'var(--brand-text)', cursor: 'pointer',
  }

  return (
    <div style={{ background: 'var(--brand-surface)', border: '1px solid var(--brand-border)', borderRadius: 16, padding: 16 }}>
      <style>{`
        .audpl-range{ -webkit-appearance:none; appearance:none; height:6px; border-radius:999px; outline:none; cursor:pointer; }
        .audpl-range::-webkit-slider-thumb{ -webkit-appearance:none; appearance:none; width:14px; height:14px; border-radius:999px; background:var(--brand-primary); box-shadow:0 1px 4px rgba(0,0,0,.3); cursor:pointer; margin-top:-4px; }
        .audpl-range::-moz-range-thumb{ width:14px; height:14px; border:none; border-radius:999px; background:var(--brand-primary); cursor:pointer; }
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

      <input
        className="audpl-range"
        type="range"
        min={0}
        max={dur || 0}
        step={0.1}
        value={cur}
        onChange={(e) => seek(Number(e.target.value))}
        style={{ width: '100%', background: track(pct) }}
        aria-label="Перемотка"
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--brand-muted)', fontVariantNumeric: 'tabular-nums', margin: '6px 2px 14px' }}>
        <span>{fmt(cur)}</span>
        <span>{fmt(dur)}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <button onClick={() => skip(-15)} title="Назад 15 секунд" style={iconBtn}>
          <RotateCcw size={17} />
          <span style={{ fontSize: 10, fontWeight: 700, marginLeft: -2 }}>15</span>
        </button>
        <button onClick={toggle} title={playing ? 'Пауза' : 'Играть'} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 52, height: 52, borderRadius: 999, border: 'none', background: 'var(--brand-primary)', color: '#fff', cursor: 'pointer' }}>
          {playing ? <Pause size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" style={{ marginLeft: 2 }} />}
        </button>
        <button onClick={() => skip(15)} title="Вперёд 15 секунд" style={iconBtn}>
          <span style={{ fontSize: 10, fontWeight: 700, marginRight: -2 }}>15</span>
          <RotateCw size={17} />
        </button>

        <div style={{ flex: 1 }} />

        <button onClick={cycleRate} title="Скорость воспроизведения" style={{ ...iconBtn, width: 'auto', padding: '0 12px', fontWeight: 700, fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
          {rate}×
        </button>
        <button onClick={toggleMute} title={muted ? 'Включить звук' : 'Выключить звук'} style={iconBtn}>
          {muted || vol === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>
        <input
          className="audpl-range"
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={muted ? 0 : vol}
          onChange={(e) => changeVol(Number(e.target.value))}
          style={{ width: 84, background: track((muted ? 0 : vol) * 100) }}
          aria-label="Громкость"
        />
      </div>
    </div>
  )
}
