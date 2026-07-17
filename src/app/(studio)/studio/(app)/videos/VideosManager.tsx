'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import * as tus from 'tus-js-client'
import { Plus, Video as VideoIcon, Loader2, Check, Clock, Link as LinkIcon, Lock, Unlock, Upload, X } from 'lucide-react'

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
        <AddPanel
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

/* Панель добавления с выбором способа: по ссылке / загрузить файл */
function AddPanel({
  tiers,
  onDone,
  onCancel,
}: {
  tiers: Tier[]
  onDone: () => void
  onCancel: () => void
}) {
  const [mode, setMode] = useState<'upload' | 'url'>('upload')
  return (
    <div className="studio-card vid__form">
      <div className="vid__tabs">
        <button
          className={`vid__tab${mode === 'upload' ? ' is-active' : ''}`}
          onClick={() => setMode('upload')}
        >
          <Upload size={15} /> Загрузить файл
        </button>
        <button
          className={`vid__tab${mode === 'url' ? ' is-active' : ''}`}
          onClick={() => setMode('url')}
        >
          <LinkIcon size={15} /> По ссылке
        </button>
      </div>

      {mode === 'upload' ? (
        <UploadFileForm tiers={tiers} onDone={onDone} onCancel={onCancel} />
      ) : (
        <UrlFields tiers={tiers} onDone={onDone} onCancel={onCancel} />
      )}
    </div>
  )
}

/* Загрузка локального файла через TUS (резюмируемая, с прогрессом) */
function UploadFileForm({
  tiers,
  onDone,
  onCancel,
}: {
  tiers: Tier[]
  onDone: () => void
  onCancel: () => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [minTierId, setMinTierId] = useState('')
  const [isPreview, setIsPreview] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [pct, setPct] = useState(0)
  const [uploaded, setUploaded] = useState(0)
  const [total, setTotal] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const uploadRef = useRef<tus.Upload | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, ''))
    setError(null)
  }

  async function start() {
    setError(null)
    if (!file) return setError('Выберите файл')
    if (!title.trim()) return setError('Укажите название')

    setUploading(true)
    setPct(0)
    setTotal(file.size)

    try {
      // 1) получаем одноразовый TUS upload-URL с сервера
      const res = await fetch('/studio/api/videos/tus-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ size: file.size, name: title.trim() }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || 'Не удалось начать загрузку')
        setUploading(false)
        return
      }
      const { uploadURL, uid } = json

      // 2) льём файл кусками напрямую в Cloudflare
      const upload = new tus.Upload(file, {
        uploadUrl: uploadURL,
        chunkSize: 50 * 1024 * 1024, // 50 МБ (минимум CF — 5 МБ)
        retryDelays: [0, 3000, 5000, 10000, 20000],
        metadata: { filename: file.name, filetype: file.type },
        onError(err) {
          setError(`Ошибка загрузки: ${err?.message || 'соединение прервано'}`)
          setUploading(false)
        },
        onProgress(bytesUploaded, bytesTotal) {
          setUploaded(bytesUploaded)
          setTotal(bytesTotal)
          setPct(Math.round((bytesUploaded / bytesTotal) * 100))
        },
        async onSuccess() {
          // 3) фиксируем запись Videos на сервере
          try {
            const cr = await fetch('/studio/api/videos/create-from-upload', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({
                uid,
                title: title.trim(),
                minTierId: minTierId || null,
                isPreview,
              }),
            })
            const cj = await cr.json()
            if (!cr.ok) {
              setError(cj.error || 'Файл залит, но запись создать не удалось')
              setUploading(false)
              return
            }
            onDone()
          } catch {
            setError('Файл залит, но запись создать не удалось')
            setUploading(false)
          }
        },
      })
      uploadRef.current = upload
      upload.start()
    } catch {
      setError('Ошибка соединения')
      setUploading(false)
    }
  }

  function cancel() {
    if (uploadRef.current) {
      uploadRef.current.abort()
      uploadRef.current = null
    }
    setUploading(false)
    setPct(0)
    onCancel()
  }

  const mb = (b: number) => (b / 1024 / 1024).toFixed(1)

  return (
    <>
      <p className="vid__form-hint">
        Загрузка идёт напрямую в Cloudflare Stream, минуя наш сервер. Большие файлы
        докачиваются при обрыве связи.
      </p>

      {!file ? (
        <button
          className="vid__drop"
          onClick={() => fileInput.current?.click()}
          type="button"
        >
          <Upload size={22} />
          <span>Выбрать видеофайл</span>
          <span className="vid__drop-hint">MP4, MOV, WebM и др.</span>
        </button>
      ) : (
        <div className="vid__file">
          <VideoIcon size={18} />
          <span className="vid__file-name">{file.name}</span>
          <span className="vid__file-size">{mb(file.size)} МБ</span>
          {!uploading && (
            <button className="catmgr__icon-btn" onClick={() => setFile(null)} title="Убрать">
              <X size={15} />
            </button>
          )}
        </div>
      )}
      <input
        ref={fileInput}
        type="file"
        accept="video/*"
        onChange={pickFile}
        style={{ display: 'none' }}
      />

      <label className="studio-field">
        <span className="studio-field__label">Название</span>
        <input
          className="studio-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={uploading}
        />
      </label>

      <div className="vid__form-row">
        <label className="studio-field" style={{ flex: 1 }}>
          <span className="studio-field__label">Уровень доступа</span>
          <select
            className="studio-input"
            value={minTierId}
            onChange={(e) => setMinTierId(e.target.value)}
            disabled={isPreview || uploading}
          >
            <option value="">Все подписчики / бесплатно</option>
            {tiers.map((t) => (
              <option key={t.id} value={String(t.id)}>{t.name} и выше</option>
            ))}
          </select>
        </label>
        <label className="vid__preview-check">
          <input
            type="checkbox"
            checked={isPreview}
            onChange={(e) => setIsPreview(e.target.checked)}
            disabled={uploading}
          />
          Бесплатное превью
        </label>
      </div>

      {uploading && (
        <div className="vid__progress">
          <div className="vid__progress-bar">
            <div className="vid__progress-fill" style={{ width: `${pct}%` }} />
          </div>
          <div className="vid__progress-text">
            {pct}% · {mb(uploaded)} / {mb(total)} МБ
          </div>
        </div>
      )}

      {error && <div className="studio-login__error">{error}</div>}

      <div className="vid__form-actions">
        <button className="studio-btn studio-btn--ghost" onClick={cancel}>
          {uploading ? 'Прервать' : 'Отмена'}
        </button>
        {!uploading && (
          <button className="studio-btn studio-btn--primary" onClick={start} disabled={!file}>
            <Upload size={16} /> Загрузить
          </button>
        )}
      </div>
    </>
  )
}

/* Поля добавления по ссылке (вынесено из формы для переиспользования в панели) */
function UrlFields({
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
    <>
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
    </>
  )
}
