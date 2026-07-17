'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Video as VideoIcon, Loader2, Check, Clock, Link as LinkIcon, Lock, Unlock } from 'lucide-react'

type Tier = { id: number | string; name: string }
type Vid = {
  id: number | string
  title: string
  videoRef: string | null
  isPreview: boolean
  minTierName: string | null
  durationSec: number | null
  coverUrl: string | null
}

function fmtDur(sec: number | null): string {
  if (!sec) return ''
  const m = Math.floor(sec / 60)
  const s = Math.round(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

export function VideosManager({
  initialVideos,
  tiers,
}: {
  initialVideos: Vid[]
  tiers: Tier[]
}) {
  const router = useRouter()
  const [videos] = useState<Vid[]>(initialVideos)
  const [adding, setAdding] = useState(false)

  return (
    <>
      <div className="studio-page-head">
        <div>
          <h1>Видео</h1>
          <div className="studio-page-head__sub">Всего: {videos.length}</div>
        </div>
        <button className="studio-btn studio-btn--primary" onClick={() => setAdding((v) => !v)}>
          <Plus size={18} />
          Добавить видео
        </button>
      </div>

      {adding && (
        <AddByUrlForm
          tiers={tiers}
          onDone={() => {
            setAdding(false)
            router.refresh()
          }}
          onCancel={() => setAdding(false)}
        />
      )}

      {videos.length === 0 ? (
        <div className="studio-empty">
          <div className="studio-empty__icon"><VideoIcon size={28} /></div>
          <div className="studio-empty__title">Видео пока нет</div>
          <div className="studio-empty__text">Добавьте первое видео по ссылке из вашего хранилища.</div>
        </div>
      ) : (
        <div className="vid__grid">
          {videos.map((v) => (
            <VideoCard key={v.id} video={v} />
          ))}
        </div>
      )}
    </>
  )
}

/* Карточка видео со статусом кодирования */
function VideoCard({ video }: { video: Vid }) {
  const [ready, setReady] = useState<boolean | null>(null)
  const [pct, setPct] = useState<string | null>(null)
  const timer = useRef<any>(null)

  useEffect(() => {
    if (!video.videoRef) return
    let stopped = false

    async function poll() {
      try {
        const res = await fetch(`/studio/api/videos/status?id=${video.id}`, {
          credentials: 'include',
        })
        const json = await res.json()
        if (stopped) return
        if (json.ready) {
          setReady(true)
          setPct(null)
          return // готово — прекращаем опрос
        }
        setReady(false)
        setPct(json.pct || null)
        timer.current = setTimeout(poll, 5000)
      } catch {
        if (!stopped) timer.current = setTimeout(poll, 8000)
      }
    }
    poll()
    return () => {
      stopped = true
      if (timer.current) clearTimeout(timer.current)
    }
  }, [video.id, video.videoRef])

  return (
    <div className="vid__card">
      <div className="vid__thumb">
        {video.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={video.coverUrl} alt="" />
        ) : (
          <div className="vid__thumb-empty"><VideoIcon size={26} /></div>
        )}
        {video.durationSec ? <span className="vid__dur">{fmtDur(video.durationSec)}</span> : null}
      </div>
      <div className="vid__body">
        <div className="vid__title">{video.title}</div>
        <div className="vid__meta">
          {video.isPreview ? (
            <span className="vid__badge vid__badge--free"><Unlock size={12} /> Бесплатно</span>
          ) : video.minTierName ? (
            <span className="vid__badge"><Lock size={12} /> {video.minTierName}</span>
          ) : (
            <span className="vid__badge"><Unlock size={12} /> Все</span>
          )}

          {ready === true && (
            <span className="vid__status vid__status--ok"><Check size={13} /> Готово</span>
          )}
          {ready === false && (
            <span className="vid__status vid__status--wait">
              <Loader2 size={13} className="spin" /> Кодируется{pct ? ` ${pct}%` : ''}
            </span>
          )}
          {ready === null && video.videoRef && (
            <span className="vid__status"><Clock size={13} /> Проверка…</span>
          )}
        </div>
      </div>
    </div>
  )
}

/* Форма добавления по ссылке */
function AddByUrlForm({
  tiers,
  onDone,
  onCancel,
}: {
  tiers: Tier[]
  onDone: () => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [minTierId, setMinTierId] = useState('')
  const [isPreview, setIsPreview] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    setError(null)
    if (!title.trim()) return setError('Укажите название')
    if (!url.trim()) return setError('Укажите ссылку на видеофайл')
    setBusy(true)
    try {
      const res = await fetch('/studio/api/videos/create-from-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: title.trim(),
          url: url.trim(),
          minTierId: minTierId || null,
          isPreview,
        }),
      })
      const json = await res.json()
      if (!res.ok) setError(json.error || 'Не удалось добавить видео')
      else onDone()
    } catch {
      setError('Ошибка соединения')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="studio-card vid__form">
      <div className="vid__form-head">
        <LinkIcon size={16} />
        Добавить видео по ссылке
      </div>
      <p className="vid__form-hint">
        Прямая ссылка на видеофайл в вашем хранилище (Яндекс Object Storage, R2, S3).
        Cloudflare Stream скачает и подготовит его сам.
      </p>

      <label className="studio-field">
        <span className="studio-field__label">Название</span>
        <input className="studio-input" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
      </label>

      <label className="studio-field">
        <span className="studio-field__label">Ссылка на видео</span>
        <input
          className="studio-input"
          placeholder="https://storage.yandexcloud.net/.../video.mp4"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
      </label>

      <div className="vid__form-row">
        <label className="studio-field" style={{ flex: 1 }}>
          <span className="studio-field__label">Уровень доступа</span>
          <select
            className="studio-input"
            value={minTierId}
            onChange={(e) => setMinTierId(e.target.value)}
            disabled={isPreview}
          >
            <option value="">Все подписчики / бесплатно</option>
            {tiers.map((t) => (
              <option key={t.id} value={String(t.id)}>{t.name} и выше</option>
            ))}
          </select>
        </label>
        <label className="vid__preview-check">
          <input type="checkbox" checked={isPreview} onChange={(e) => setIsPreview(e.target.checked)} />
          Бесплатное превью
        </label>
      </div>

      {error && <div className="studio-login__error">{error}</div>}

      <div className="vid__form-actions">
        <button className="studio-btn studio-btn--ghost" onClick={onCancel}>Отмена</button>
        <button className="studio-btn studio-btn--primary" onClick={submit} disabled={busy}>
          {busy ? <Loader2 size={16} className="spin" /> : <Plus size={16} />}
          Добавить
        </button>
      </div>
    </div>
  )
}
