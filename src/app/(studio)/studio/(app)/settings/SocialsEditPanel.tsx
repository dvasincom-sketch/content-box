'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Loader2, Check, Plus, Trash2 } from 'lucide-react'
import { StudioSelect } from '../_ui/StudioSelect'

/**
 * Выдвижная панель редактирования секции «Соцсети» из конструктора главной.
 * Раньше соцсети жили отдельной вкладкой настроек — перенесены сюда. Каждая
 * строка: площадка + ссылка + подпись (описание под названием на карточке).
 *
 * GET  /studio/api/settings/socials → { socials: [{ platform, url, description }] }
 * POST /studio/api/settings/socials
 */

type Row = { platform: string; url: string; description: string }

const PLATFORMS = [
  { value: 'boosty', label: 'Boosty' },
  { value: 'vk', label: 'VK' },
  { value: 'telegram', label: 'Telegram' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'instagram', label: 'Instagram' },
]

const HINT_PLACEHOLDER: Record<string, string> = {
  boosty: 'Эксклюзив и ранний доступ',
  telegram: 'Анонсы и новые видео',
  vk: 'Всё видео проекта',
  youtube: 'Новости и шортсы',
  instagram: 'Бэкстейджи и сторис',
}

export function SocialsEditPanel({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<Row[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    let stop = false
    setLoading(true)
    setError(null)
    fetch('/studio/api/settings/socials', { credentials: 'include' })
      .then((r) => r.json())
      .then((json) => {
        if (stop) return
        if (json?.error) setError(json.error)
        else if (Array.isArray(json?.socials)) {
          setRows(
            json.socials.map((s: any) => ({
              platform: String(s?.platform || 'telegram'),
              url: String(s?.url || ''),
              description: String(s?.description || ''),
            })),
          )
        }
      })
      .catch(() => !stop && setError('Не удалось загрузить данные'))
      .finally(() => !stop && setLoading(false))
    return () => {
      stop = true
    }
  }, [])

  function update(i: number, patch: Partial<Row>) {
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)))
  }
  function add() {
    setRows((r) => [...r, { platform: 'telegram', url: '', description: '' }])
  }
  function remove(i: number) {
    setRows((r) => r.filter((_, idx) => idx !== i))
  }

  async function save() {
    setError(null)
    for (const r of rows) {
      if (!r.url.trim()) {
        setError('У каждой соцсети должна быть ссылка')
        return
      }
    }
    setSaving(true)
    try {
      const res = await fetch('/studio/api/settings/socials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ socials: rows }),
      })
      const json = await res.json()
      if (!res.ok || json.error) {
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

  const panel = (
    <div className="studio-portal">
      <div className="catedit__overlay" onClick={onClose}>
        <div className="catedit" onClick={(e) => e.stopPropagation()}>
          <div className="catedit__head">
            <h3>Соцсети</h3>
            <button className="catmgr__icon-btn" onClick={onClose} title="Закрыть">
              <X size={18} />
            </button>
          </div>

          <div className="catedit__body">
            {loading ? (
              <div className="menubld__loading">
                <Loader2 size={18} className="spin" /> Загрузка…
              </div>
            ) : (
              <>
                <div className="catedit__hint">
                  Ссылки на соцсети в блоке «Присоединяйся к сообществу» на главной (и в шапке/футере). Подпись — короткое описание под названием карточки; пусто — подставится подпись по умолчанию.
                </div>

                {rows.length === 0 ? (
                  <p className="settings__hint">Пока не добавлено ни одной ссылки.</p>
                ) : (
                  <div className="soceditp__list">
                    {rows.map((row, i) => (
                      <div key={i} className="soceditp__item">
                        <div className="soceditp__row1">
                          <StudioSelect
                            value={row.platform}
                            onChange={(v) => update(i, { platform: v })}
                            options={PLATFORMS}
                            ariaLabel="Площадка"
                          />
                          <button
                            className="catmgr__icon-btn catmgr__icon-btn--danger"
                            onClick={() => remove(i)}
                            title="Удалить"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                        <input
                          className="studio-input"
                          placeholder="https://…"
                          value={row.url}
                          onChange={(e) => update(i, { url: e.target.value })}
                        />
                        <input
                          className="studio-input"
                          placeholder={HINT_PLACEHOLDER[row.platform] || 'Подпись под названием'}
                          value={row.description}
                          onChange={(e) => update(i, { description: e.target.value })}
                        />
                      </div>
                    ))}
                  </div>
                )}

                <button className="studio-btn studio-btn--ghost settings__add" onClick={add}>
                  <Plus size={16} /> Добавить ссылку
                </button>

                {error && <div className="studio-login__error">{error}</div>}
              </>
            )}
          </div>

          <div className="catedit__foot">
            <button className="studio-btn studio-btn--ghost" onClick={onClose}>
              Отмена
            </button>
            <button className="studio-btn studio-btn--primary" onClick={save} disabled={saving || loading}>
              {saving ? <Loader2 size={16} className="spin" /> : <Check size={16} />}
              Сохранить
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  if (!mounted) return null
  return createPortal(panel, document.body)
}
