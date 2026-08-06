'use client'

import React, { useRef, useState } from 'react'
import { ImagePlus, Loader2 } from 'lucide-react'

/**
 * Загрузчик картинки для «Оформления» (обобщение LogoBlock). Один и тот же
 * компонент для логотипа, иконки приложения и OG-картинки — отличается полем
 * `field` (см. роут /studio/api/settings/image) и подписями.
 */
export function ImageUploadField({
  field,
  title,
  hint,
  initialUrl,
  square = false,
  compact = false,
}: {
  field: 'logo' | 'appIcon' | 'ogImage'
  title: string
  hint: string
  initialUrl: string | null
  square?: boolean
  compact?: boolean
}) {
  const [url, setUrl] = useState<string | null>(initialUrl)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('field', field)
      const res = await fetch('/studio/api/settings/image', { method: 'POST', body: fd, credentials: 'include' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) setError(json.error || 'Не удалось загрузить')
      else setUrl(json.url)
    } catch {
      setError('Ошибка загрузки')
    } finally {
      setUploading(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  if (compact) {
    return (
      <div className="imgfield">
        {url ? (
          <div className={'imgfield__preview' + (square ? ' imgfield__preview--square' : '')}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={title} style={square ? { objectFit: 'cover' } : undefined} />
          </div>
        ) : (
          <div className={'imgfield__empty' + (square ? ' imgfield__preview--square' : '')} aria-hidden>
            <ImagePlus size={16} />
          </div>
        )}
        <div className="imgfield__text">
          <h3>{title}</h3>
          <p>{hint}</p>
          {error && <div className="settings__err">{error}</div>}
        </div>
        <button className="studio-btn studio-btn--ghost imgfield__btn" onClick={() => fileInput.current?.click()} disabled={uploading}>
          {uploading ? <Loader2 size={16} className="spin" /> : <ImagePlus size={16} />}
          {url ? 'Заменить' : 'Загрузить'}
        </button>
        <input ref={fileInput} type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} />
      </div>
    )
  }

  return (
    <section className="settings__block">
      <div className="settings__block-head">
        <h2>{title}</h2>
        <p>{hint}</p>
      </div>
      <div className="settings__logo">
        {url ? (
          <div className="settings__logo-preview" style={square ? { aspectRatio: '1 / 1', width: 72 } : undefined}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={title} style={square ? { objectFit: 'cover' } : undefined} />
          </div>
        ) : (
          <div className="settings__logo-empty">Нет изображения</div>
        )}
        <div>
          <button className="studio-btn studio-btn--ghost" onClick={() => fileInput.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 size={16} className="spin" /> : <ImagePlus size={16} />}
            {url ? 'Заменить' : 'Загрузить'}
          </button>
          <input ref={fileInput} type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} />
          {error && <div className="settings__err">{error}</div>}
        </div>
      </div>
    </section>
  )
}
