'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Loader2, Check, Plus, Trash2 } from 'lucide-react'
import { StudioSelect } from '../_ui/StudioSelect'
import { WHY_ICONS, WHY_ICON_LABELS, type WhyIcon } from '@/lib/whyUs'

/**
 * Выдвижная панель редактирования секции «Почему мы» из конструктора главной.
 * Каждая карточка: иконка + заголовок + описание. Пустой список → блок
 * откатывается на карточки по умолчанию.
 *
 * GET  /studio/api/settings/why → { items: [{ icon, title, text }] }
 * POST /studio/api/settings/why
 */

type Row = { icon: WhyIcon; title: string; text: string }

const ICON_OPTIONS = WHY_ICONS.map((v) => ({ value: v, label: WHY_ICON_LABELS[v] }))

export function WhyUsEditPanel({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
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
    fetch('/studio/api/settings/why', { credentials: 'include' })
      .then((r) => r.json())
      .then((json) => {
        if (stop) return
        if (json?.error) setError(json.error)
        else if (Array.isArray(json?.items)) {
          setRows(
            json.items.map((it: any) => ({
              icon: (WHY_ICONS as string[]).includes(it?.icon) ? (it.icon as WhyIcon) : 'zap',
              title: String(it?.title || ''),
              text: String(it?.text || ''),
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
    setRows((r) => [...r, { icon: 'zap', title: '', text: '' }])
  }
  function remove(i: number) {
    setRows((r) => r.filter((_, idx) => idx !== i))
  }

  async function save() {
    setError(null)
    setSaving(true)
    try {
      const items = rows
        .map((r) => ({ icon: r.icon, title: r.title.trim(), text: r.text.trim() }))
        .filter((r) => r.title || r.text)
      const res = await fetch('/studio/api/settings/why', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ items }),
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
            <h3>«Почему мы»</h3>
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
                  Карточки-преимущества на главной: иконка, заголовок и описание. Если удалить все — покажутся карточки по умолчанию.
                </div>

                {rows.length === 0 ? (
                  <p className="settings__hint">Карточек нет — будут показаны значения по умолчанию.</p>
                ) : (
                  <div className="soceditp__list">
                    {rows.map((row, i) => (
                      <div key={i} className="soceditp__item">
                        <div className="soceditp__row1">
                          <StudioSelect
                            value={row.icon}
                            onChange={(v) => update(i, { icon: v as WhyIcon })}
                            options={ICON_OPTIONS}
                            ariaLabel="Иконка"
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
                          placeholder="Заголовок"
                          value={row.title}
                          maxLength={120}
                          onChange={(e) => update(i, { title: e.target.value })}
                        />
                        <textarea
                          className="studio-input"
                          rows={2}
                          placeholder="Описание"
                          value={row.text}
                          maxLength={400}
                          onChange={(e) => update(i, { text: e.target.value })}
                        />
                      </div>
                    ))}
                  </div>
                )}

                <button className="studio-btn studio-btn--ghost settings__add" onClick={add}>
                  <Plus size={16} /> Добавить карточку
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
