'use client'

import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import { DownloadCloud, X, Loader2, Check } from 'lucide-react'
import { StudioSelect } from '../_ui/StudioSelect'

/**
 * Модалка «Импорт плейлиста VK» (вызывается кнопкой рядом с «Добавить видео»).
 * Видео не хранятся у нас — создаются embed-записи (плеер VK). Обложки качаются
 * в наш R2. Повторный импорт добавляет только новые (дедуп по VK id).
 */

type Category = { id: number | string; title: string; depth?: number }
type Result = { added: number; skipped: number; unavailable: number; total: number }

export function VkPlaylistImportModal({
  categories,
  onClose,
  onDone,
}: {
  categories: Category[]
  onClose: () => void
  onDone?: () => void
}) {
  const [url, setUrl] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [verify, setVerify] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<Result | null>(null)

  const options = categories.map((c) => ({ value: String(c.id), label: c.title, depth: c.depth }))

  async function run() {
    setError(null)
    setResult(null)
    if (!url.trim()) { setError('Вставьте ссылку на плейлист VK'); return }
    if (!categoryId) { setError('Выберите категорию'); return }
    setBusy(true)
    try {
      const res = await fetch('/studio/api/videos/import-vk-playlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ playlistUrl: url.trim(), categoryId, verify }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) setError(json.error || 'Не удалось импортировать')
      else setResult({ added: json.added || 0, skipped: json.skipped || 0, unavailable: json.unavailable || 0, total: json.total || 0 })
    } catch {
      setError('Ошибка соединения')
    } finally {
      setBusy(false)
    }
  }

  function finish() {
    if (result && result.added > 0 && onDone) onDone()
    else onClose()
  }

  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      className="uk-overlay"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '6vh 16px', zIndex: 1000, overflow: 'auto' }}
    >
      <div className="studio-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560, width: '100%', padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <DownloadCloud size={20} style={{ color: 'var(--st-primary)' }} />
          <strong style={{ fontSize: 16 }}>Импорт плейлиста VK</strong>
          <button type="button" onClick={onClose} aria-label="Закрыть" style={{ marginLeft: 'auto', background: 'none', border: 0, cursor: 'pointer', color: 'var(--st-text-muted)' }}>
            <X size={18} />
          </button>
        </div>

        <p style={{ marginTop: 0, fontSize: 13, color: 'var(--st-text-muted)' }}>
          Видео добавятся как внешние вставки (плеер VK) — они всегда бесплатны, подпиской не закрываются,
          у нас не хранятся. Обложки скачаются в наше хранилище. Повторный импорт добавит только новые ролики.
        </p>

        <label className="studio-field" style={{ display: 'block', marginBottom: 12 }}>
          <span className="studio-field__label">Ссылка на плейлист VK</span>
          <input
            className="studio-input"
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://vkvideo.ru/playlist/-217576166_30"
            spellCheck={false}
            autoFocus
          />
        </label>

        <label className="studio-field" style={{ display: 'block', marginBottom: 12 }}>
          <span className="studio-field__label">Категория (раздел «Смотреть»)</span>
          <StudioSelect
            value={categoryId}
            onChange={setCategoryId}
            options={options}
            placeholder="— выбрать категорию —"
            ariaLabel="Категория для импорта"
            searchable
          />
        </label>

        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 4, cursor: 'pointer', fontSize: 13 }}>
          <input type="checkbox" checked={verify} onChange={(e) => setVerify(e.target.checked)} style={{ marginTop: 2 }} />
          <span>
            Строгая проверка доступности каждого видео <span style={{ color: 'var(--st-text-muted)' }}>(медленнее — опрашивает VK по каждому ролику; иначе статус ставится «доступно» по факту наличия в плейлисте)</span>
          </span>
        </label>

        {error && <div className="settings__err" style={{ marginTop: 10 }}>{error}</div>}
        {result && (
          <div className="nl-policy" style={{ marginTop: 12 }}>
            <Check size={18} style={{ color: 'var(--st-primary)' }} />
            <span>Готово. Добавлено <b>{result.added}</b> · пропущено (уже есть) <b>{result.skipped}</b> · недоступно <b>{result.unavailable}</b> из <b>{result.total}</b>.</span>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          {!result ? (
            <>
              <button type="button" className="studio-btn studio-btn--primary" onClick={run} disabled={busy}>
                {busy ? <><Loader2 size={15} className="spin" /> Импортирую…</> : 'Импортировать'}
              </button>
              <button type="button" className="studio-btn" onClick={onClose} disabled={busy}>Отмена</button>
            </>
          ) : (
            <button type="button" className="studio-btn studio-btn--primary" onClick={finish}>Готово</button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
