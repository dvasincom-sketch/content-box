'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { X, Loader2, Check, FileText, ArrowUpRight } from 'lucide-react'
import { StudioSelect } from '../_ui/StudioSelect'

type Tier = { id: number | string; name: string }

export type EditableVideo = {
  id: number | string
  title: string
  minTierId: string
  usedIn: { id: number | string; title: string }[]
}

/**
 * Выдвижная панель редактирования видео (в стиле CategoryEditPanel).
 * Меняем только название и уровень доступа. Сохранение одним запросом
 * на /studio/api/videos/update.
 *
 * Порталим в body: панель вызывается из строки таблицы видео, а у таблицы
 * overflow + стеклянные карточки/анимации создают stacking-контексты,
 * из-за которых fixed-оверлей иначе застревает внутри таблицы.
 */
export function VideoEditModal({
  video,
  tiers,
  onClose,
  onSaved,
}: {
  video: EditableVideo
  tiers: Tier[]
  onClose: () => void
  onSaved: () => void
}) {
  const [title, setTitle] = useState(video.title)
  const [minTierId, setMinTierId] = useState<string>(video.minTierId || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  async function save() {
    setError(null)
    if (!title.trim()) {
      setError('Название не может быть пустым')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/studio/api/videos/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          videoId: video.id,
          title: title.trim(),
          minTierId: minTierId || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || 'Не удалось сохранить')
        setSaving(false)
        return
      }
      onSaved()
    } catch {
      setError('Ошибка соединения')
      setSaving(false)
    }
  }

  if (!mounted) return null

  return createPortal(
    <div className="studio-portal">
      <div className="catedit__overlay" onClick={onClose}>
        <div className="catedit" onClick={(e) => e.stopPropagation()}>
          <div className="catedit__head">
            <h3>Редактирование видео</h3>
            <button className="catmgr__icon-btn" onClick={onClose} title="Закрыть">
              <X size={18} />
            </button>
          </div>

          <div className="catedit__body">
            <div className="studio-field">
              <span className="studio-field__label">Название</span>
              <input
                className="studio-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                autoFocus
              />
            </div>

            <div className="studio-field">
              <span className="studio-field__label">Уровень доступа</span>
              <StudioSelect
                value={minTierId}
                onChange={setMinTierId}
                options={[
                  { value: '', label: 'Все подписчики / бесплатно' },
                  ...tiers.map((t) => ({ value: String(t.id), label: `${t.name} и выше` })),
                ]}
                ariaLabel="Уровень доступа"
              />
            </div>

            {error && <div className="studio-login__error">{error}</div>}

            <div className="videdit__used">
              <div className="videdit__used-label">Используется в публикациях</div>
              {video.usedIn.length === 0 ? (
                <div className="videdit__used-empty">Не прикреплено ни к одной публикации</div>
              ) : (
                <ul className="videdit__used-list">
                  {video.usedIn.map((p) => (
                    <li key={p.id}>
                      <Link href={`/studio/posts/${p.id}`} className="videdit__used-link" onClick={onClose}>
                        <FileText size={14} className="videdit__used-icon" />
                        <span className="videdit__used-title">{p.title}</span>
                        <ArrowUpRight size={14} className="videdit__used-arrow" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="catedit__foot">
            <button className="studio-btn studio-btn--ghost" onClick={onClose}>
              Отмена
            </button>
            <button className="studio-btn studio-btn--primary" onClick={save} disabled={saving}>
              {saving ? <Loader2 size={16} className="spin" /> : <Check size={16} />}
              Сохранить
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
