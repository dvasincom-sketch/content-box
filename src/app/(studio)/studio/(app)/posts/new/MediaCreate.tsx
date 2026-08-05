'use client'

import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Upload, Loader2 } from 'lucide-react'
import { AddPanel } from '../../videos/VideosManager'

type Tier = { id: number | string; name: string }
type MetaCat = { id: number | string; title: string; depth: number }
export type CreatedMedia = { id: number | string; title: string }

/**
 * Создание видео прямо из композера публикации. Переиспользует студийную форму
 * добавления видео (AddPanel) в модалке-портале. Когда видео создано, форма
 * зовёт onCreated(id, title) — публикация сразу прикрепляет его, не уходя в
 * раздел «Медиа».
 */
export function VideoCreateModal({
  tiers,
  categories,
  onCreated,
  onClose,
}: {
  tiers: Tier[]
  categories: MetaCat[]
  onCreated: (v: CreatedMedia) => void
  onClose: () => void
}) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null

  return createPortal(
    <div
      className="studio-portal"
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)',
        display: 'grid', placeItems: 'start center', padding: 16, overflow: 'auto', zIndex: 60,
      }}
      onClick={onClose}
    >
      <div style={{ width: 'min(720px, 100%)', margin: '24px 0' }} onClick={(e) => e.stopPropagation()}>
        <AddPanel
          tiers={tiers}
          categories={categories}
          onCreated={onCreated}
          onDone={onClose}
          onCancel={onClose}
        />
      </div>
    </div>,
    document.body,
  )
}

/**
 * Загрузка аудио (MP3) из композера одним действием — как «Загрузить с
 * устройства» у галереи: клик открывает выбор файла, выбранный файл сразу
 * уходит на сервер (создаётся videos с provider='audio'), затем onCreated
 * прикрепляет его к публикации. Уровень/категорию можно задать позже в
 * разделе «Аудио». Название = имя файла.
 */
export function AudioUploadButton({
  onCreated,
  className = 'gcomp__add',
}: {
  onCreated: (v: CreatedMedia) => void
  className?: string
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    const title = f.name.replace(/\.[^.]+$/, '')
    setBusy(true); setError(null)
    try {
      const fd = new FormData()
      fd.append('file', f)
      fd.append('title', title)
      const res = await fetch('/studio/api/videos/audio-upload', {
        method: 'POST', credentials: 'include', body: fd,
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) setError(json.error || 'Не удалось загрузить аудио')
      else onCreated({ id: json.id, title })
    } catch {
      setError('Ошибка загрузки')
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  return (
    <>
      <button type="button" className={className} onClick={() => input.current?.click()} disabled={busy}>
        {busy ? <Loader2 size={16} className="spin" /> : <Upload size={16} />}
        {busy ? 'Загрузка…' : 'Загрузить с устройства'}
      </button>
      <input ref={input} type="file" accept="audio/*,.mp3" onChange={pick} style={{ display: 'none' }} />
      {error && <div className="studio-login__error" style={{ flexBasis: '100%', width: '100%' }}>{error}</div>}
    </>
  )
}
