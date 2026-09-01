'use client'

import React, { useState } from 'react'
import { Loader2 } from 'lucide-react'

/**
 * Тумблер сквозного виджета Аси (кнопка «Спросить Асю» в правом нижнем углу).
 * POST /studio/api/settings/asya-widget. Пока ассистент сырой — можно выключить.
 */
export function AsyaWidgetToggle({ initial }: { initial: boolean }) {
  const [on, setOn] = useState<boolean>(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function toggle() {
    if (saving) return
    const next = !on
    setOn(next)
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/studio/api/settings/asya-widget', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ enabled: next }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setError(j.error || 'Не удалось сохранить')
        setOn(!next)
      }
    } catch {
      setError('Ошибка сохранения')
      setOn(!next)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="settings__block">
      <div className="settings__block-head">
        <h2>Ассистент Ася</h2>
        <p>Сквозная кнопка «Спросить Асю» в правом нижнем углу сайта. Пока ассистент дорабатывается, его можно выключить.</p>
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: saving ? 'default' : 'pointer' }}>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          onClick={toggle}
          disabled={saving}
          style={{
            position: 'relative', width: 46, height: 26, borderRadius: 999, border: 'none', flexShrink: 0,
            cursor: saving ? 'default' : 'pointer',
            background: on ? 'var(--brand-primary, #e86a33)' : 'var(--st-border, #d1d5db)',
            transition: 'background .2s ease',
          }}
        >
          <span
            style={{
              position: 'absolute', top: 3, left: on ? 23 : 3, width: 20, height: 20, borderRadius: '50%',
              background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.3)', transition: 'left .2s ease',
            }}
          />
        </button>
        <span style={{ fontSize: 14, color: 'var(--st-text, #111)', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          {on ? 'Виджет включён' : 'Виджет выключен'}
          {saving && <Loader2 size={14} className="spin" />}
        </span>
      </label>
      {error && <div className="studio-login__error" style={{ marginTop: 8 }}>{error}</div>}
    </section>
  )
}
