'use client'

import React, { useState } from 'react'
import { DownloadCloud, Loader2, ChevronDown, Check } from 'lucide-react'
import { StudioSelect } from '../_ui/StudioSelect'

/**
 * Импорт плейлиста VK Видео в категорию (Студия → Видео).
 * Видео не хранятся у нас — создаются embed-записи (плеер VK). Обложки
 * скачиваются в наш R2. Повторный импорт добавляет только новые (дедуп по VK id).
 */

type Category = { id: number | string; title: string; parentId?: number | string | null }
type Result = { added: number; skipped: number; unavailable: number; total: number }

export function VkPlaylistImportPanel({ categories }: { categories: Category[] }) {
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<Result | null>(null)

  const options = categories.map((c) => ({ value: String(c.id), label: c.title }))

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
        body: JSON.stringify({ playlistUrl: url.trim(), categoryId }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.error || 'Не удалось импортировать')
      } else {
        setResult({ added: json.added || 0, skipped: json.skipped || 0, unavailable: json.unavailable || 0, total: json.total || 0 })
      }
    } catch {
      setError('Ошибка соединения')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="studio-card" style={{ padding: 0, marginBottom: 16, overflow: 'hidden' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', background: 'none', border: 0, cursor: 'pointer', textAlign: 'left', color: 'inherit' }}
        aria-expanded={open}
      >
        <DownloadCloud size={18} style={{ color: 'var(--st-primary)' }} />
        <span style={{ fontWeight: 600 }}>Импорт плейлиста VK</span>
        <span style={{ marginLeft: 8, fontSize: 13, color: 'var(--st-text-muted)' }}>переносит видео ссылками, без хранения у нас</span>
        <ChevronDown size={18} style={{ marginLeft: 'auto', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s', color: 'var(--st-text-muted)' }} />
      </button>

      {open && (
        <div style={{ padding: '0 16px 16px' }}>
          <p style={{ marginTop: 0, fontSize: 13, color: 'var(--st-text-muted)' }}>
            Вставьте ссылку на плейлист VK (например <code>vkvideo.ru/playlist/-217576166_30</code>) и выберите категорию.
            Видео добавятся как внешние вставки — они всегда бесплатны, подпиской не закрываются.
            Повторный импорт добавит только новые ролики.
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
            <label className="studio-field" style={{ flex: '2 1 320px' }}>
              <span className="studio-field__label">Ссылка на плейлист VK</span>
              <input
                className="studio-input"
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://vkvideo.ru/playlist/-217576166_30"
                spellCheck={false}
              />
            </label>
            <label className="studio-field" style={{ flex: '1 1 220px' }}>
              <span className="studio-field__label">Категория</span>
              <StudioSelect
                value={categoryId}
                onChange={setCategoryId}
                options={options}
                placeholder="— выбрать категорию —"
                ariaLabel="Категория для импорта"
                searchable
              />
            </label>
            <button type="button" className="studio-btn studio-btn--primary" onClick={run} disabled={busy} style={{ height: 40 }}>
              {busy ? <><Loader2 size={15} className="spin" /> Импортирую…</> : 'Импортировать'}
            </button>
          </div>

          {error && <div className="settings__err" style={{ marginTop: 10 }}>{error}</div>}
          {result && (
            <div className="nl-policy" style={{ marginTop: 12 }}>
              <Check size={18} style={{ color: 'var(--st-primary)' }} />
              <span>
                Готово. Добавлено <b>{result.added}</b> · пропущено (уже есть) <b>{result.skipped}</b> · недоступно <b>{result.unavailable}</b> из <b>{result.total}</b>.
                {result.added > 0 ? ' Обновите страницу, чтобы увидеть новые видео.' : ''}
              </span>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
