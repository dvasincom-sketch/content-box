'use client'

import React, { useState } from 'react'
import { Check, Loader2, Ban } from 'lucide-react'
import { BG_DECORS } from '@/lib/bgDecors'

/**
 * Выбор фонового декора фан-сайта из библиотеки (Оформление). Клик по карточке
 * сохраняет выбор (POST /studio/api/settings/bg-decor). Превью объекта — та же
 * SVG-маска, что и на сайте, залитая цветом текста студии.
 */
export function BgDecorPicker({ initial }: { initial: string | null }) {
  const [value, setValue] = useState<string>(initial && initial !== 'none' ? initial : 'none')
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function pick(slug: string) {
    if (slug === value || saving) return
    const prev = value
    setValue(slug)
    setSaving(slug)
    setError(null)
    try {
      const res = await fetch('/studio/api/settings/bg-decor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ bgDecor: slug }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setError(j.error || 'Не удалось сохранить')
        setValue(prev)
      }
    } catch {
      setError('Ошибка сохранения')
      setValue(prev)
    } finally {
      setSaving(null)
    }
  }

  return (
    <section className="settings__block">
      <div className="settings__block-head">
        <h2>Фоновый декор</h2>
        <p>Объекты на фоне сайта из библиотеки — приглушённо, в цвете темы, за контентом.</p>
      </div>
      <div className="bgdecor__grid">
        <button
          type="button"
          className={'bgdecor__card' + (value === 'none' ? ' is-active' : '')}
          onClick={() => pick('none')}
        >
          <span className="bgdecor__thumb bgdecor__thumb--none"><Ban size={20} /></span>
          <span className="bgdecor__label">Нет</span>
          {value === 'none' && <span className="bgdecor__check"><Check size={13} /></span>}
        </button>
        {BG_DECORS.map((d) => (
          <button
            key={d.slug}
            type="button"
            className={'bgdecor__card' + (value === d.slug ? ' is-active' : '')}
            onClick={() => pick(d.slug)}
          >
            <span
              className="bgdecor__thumb"
              style={{
                WebkitMaskImage: `url(/theme/decor/${d.slug}.svg)`,
                maskImage: `url(/theme/decor/${d.slug}.svg)`,
              }}
              aria-hidden
            />
            <span className="bgdecor__label">{d.name}</span>
            {saving === d.slug ? (
              <span className="bgdecor__check"><Loader2 size={13} className="spin" /></span>
            ) : value === d.slug ? (
              <span className="bgdecor__check"><Check size={13} /></span>
            ) : null}
          </button>
        ))}
      </div>
      {error && <div className="settings__err">{error}</div>}
    </section>
  )
}
