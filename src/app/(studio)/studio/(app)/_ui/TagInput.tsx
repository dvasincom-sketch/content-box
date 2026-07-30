'use client'

import React, { useState } from 'react'
import { X } from 'lucide-react'

/**
 * Ввод свободных тегов: чипы + поле. Enter или запятая добавляют тег,
 * Backspace на пустом поле убирает последний. Дедуп без учёта регистра.
 * Значение — массив строк-лейблов; slug посчитает сервер (normalizeTags).
 *
 * Стили инлайном на brand-переменных — чтобы не трогать студийный CSS.
 */
export function TagInput({
  value,
  onChange,
  placeholder,
}: {
  value: string[]
  onChange: (tags: string[]) => void
  placeholder?: string
}) {
  const [draft, setDraft] = useState('')

  const add = (raw: string) => {
    const parts = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    if (!parts.length) return
    const next = [...value]
    for (const p of parts) {
      if (!next.some((t) => t.toLowerCase() === p.toLowerCase())) next.push(p)
    }
    onChange(next)
    setDraft('')
  }

  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i))

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 6,
        padding: 6,
        borderRadius: 10,
        background: 'var(--st-input-bg, rgba(255,255,255,.04))',
        border: '1px solid var(--st-border, rgba(255,255,255,.14))',
      }}
    >
      {value.map((t, i) => (
        <span
          key={`${t}-${i}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '3px 6px 3px 9px',
            borderRadius: 999,
            fontSize: 13,
            background: 'color-mix(in srgb, var(--brand-primary, #6c5ce7) 18%, transparent)',
            color: 'var(--st-text, inherit)',
          }}
        >
          {t}
          <button
            type="button"
            onClick={() => remove(i)}
            aria-label={`Убрать тег ${t}`}
            style={{
              display: 'inline-flex',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              color: 'inherit',
              opacity: 0.7,
              padding: 0,
            }}
          >
            <X size={13} />
          </button>
        </span>
      ))}
      <input
        value={draft}
        placeholder={value.length ? '' : placeholder || 'Добавьте тег и нажмите Enter'}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault()
            add(draft)
          } else if (e.key === 'Backspace' && !draft && value.length) {
            remove(value.length - 1)
          }
        }}
        onBlur={() => draft.trim() && add(draft)}
        style={{
          flex: '1 1 120px',
          minWidth: 120,
          border: 'none',
          outline: 'none',
          background: 'transparent',
          color: 'inherit',
          fontSize: 14,
          padding: '4px 2px',
        }}
      />
    </div>
  )
}
