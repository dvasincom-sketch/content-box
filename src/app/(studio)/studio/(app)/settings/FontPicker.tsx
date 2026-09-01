'use client'

import React, { useState } from 'react'
import { Loader2, Check } from 'lucide-react'
import { StudioSelect } from '../_ui/StudioSelect'
import { FONT_LABEL, FONT_STACK, type FontKey } from '@/lib/themePresets'

/**
 * Выбор шрифта поверх пресета темы (заголовки/текст). Пусто = «как в теме».
 * Сохраняет в site-settings.fontHeading/fontBody (POST /studio/api/settings/fonts).
 * Все шрифты уже подключены (@font-face), поэтому выбор применяется сразу.
 */
const FONT_KEYS = Object.keys(FONT_STACK) as FontKey[]

export function FontPicker({ initialHeading, initialBody }: { initialHeading: string | null; initialBody: string | null }) {
  const [heading, setHeading] = useState<string>(initialHeading && initialHeading in FONT_STACK ? initialHeading : '')
  const [body, setBody] = useState<string>(initialBody && initialBody in FONT_STACK ? initialBody : '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function persist(nextHeading: string, nextBody: string) {
    setSaving(true); setError(null); setSaved(false)
    try {
      const res = await fetch('/studio/api/settings/fonts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ fontHeading: nextHeading || null, fontBody: nextBody || null }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setError(j.error || 'Не удалось сохранить')
      } else {
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      }
    } catch {
      setError('Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }

  const options = [
    { value: '', label: 'Как в теме' },
    ...FONT_KEYS.map((k) => ({ value: k, label: FONT_LABEL[k] })),
  ]

  return (
    <section className="settings__block">
      <div className="settings__block-head">
        <h2>Шрифты</h2>
        <p>Переопределите шрифт поверх выбранной темы. «Как в теме» — оставить шрифт пресета.</p>
      </div>
      <div className="vid__form-row" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <label className="studio-field" style={{ flex: 1, minWidth: 200 }}>
          <span className="studio-field__label">Заголовки</span>
          <StudioSelect
            value={heading}
            onChange={(v) => { setHeading(v); persist(v, body) }}
            options={options}
            ariaLabel="Шрифт заголовков"
          />
          <div style={{ fontFamily: heading ? FONT_STACK[heading as FontKey] : 'inherit', fontSize: 20, fontWeight: 700, marginTop: 8, color: 'var(--st-text)' }}>
            Заголовок · BTS
          </div>
        </label>
        <label className="studio-field" style={{ flex: 1, minWidth: 200 }}>
          <span className="studio-field__label">Основной текст</span>
          <StudioSelect
            value={body}
            onChange={(v) => { setBody(v); persist(heading, v) }}
            options={options}
            ariaLabel="Шрифт текста"
          />
          <div style={{ fontFamily: body ? FONT_STACK[body as FontKey] : 'inherit', fontSize: 15, marginTop: 8, color: 'var(--st-text)' }}>
            Пример основного текста для чтения.
          </div>
        </label>
      </div>
      <div style={{ minHeight: 18, marginTop: 4, fontSize: 13 }}>
        {saving && <span style={{ color: 'var(--st-text-muted)', display: 'inline-flex', alignItems: 'center', gap: 6 }}><Loader2 size={13} className="spin" /> Сохранение…</span>}
        {saved && !saving && <span style={{ color: 'var(--brand-primary, #e86a33)', display: 'inline-flex', alignItems: 'center', gap: 6 }}><Check size={14} /> Сохранено</span>}
        {error && <span className="studio-login__error">{error}</span>}
      </div>
    </section>
  )
}
