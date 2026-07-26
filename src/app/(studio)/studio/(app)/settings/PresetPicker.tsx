'use client'

import React, { useState } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { THEME_PRESETS, FONT_STACK, FONT_LABEL, type PresetColors } from '@/lib/themePresets'

/**
 * Выбор готовой темы-пресета сайта (Студия → Оформление).
 *
 * Пресет — ЕДИНЫЙ выбор: задаёт сразу светлую и тёмную палитры И пару шрифтов.
 * Раздельного выбора цвета/шрифта нет. Клик по карточке сразу сохраняет пресет
 * тенанту (POST /studio/api/settings/theme-preset). Свотчи и сэмпл шрифта
 * рендерятся из данных THEME_PRESETS (в студии нет --brand-* переменных, поэтому
 * цвета и шрифты подставляются инлайн).
 */

function Swatch({ colors, label }: { colors: PresetColors; label: string }) {
  return (
    <div className="preset-swatch" style={{ background: colors.bg }}>
      <div className="preset-swatch__surface" style={{ background: colors.surface }}>
        <span className="preset-swatch__dot" style={{ background: colors.primary }} />
        <span className="preset-swatch__dot" style={{ background: colors.accent }} />
        <span className="preset-swatch__aa" style={{ color: colors.text }}>Aa</span>
      </div>
      <span className="preset-swatch__label" style={{ color: colors.text }}>{label}</span>
    </div>
  )
}

export function PresetPicker({ initial }: { initial: string }) {
  const [selected, setSelected] = useState(initial)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [savedId, setSavedId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function choose(id: string) {
    if (id === selected || savingId) return
    const prev = selected
    setSelected(id)
    setSavingId(id)
    setSavedId(null)
    setError(null)
    try {
      const res = await fetch('/studio/api/settings/theme-preset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ preset: id }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setSelected(prev)
        setError(json.error || 'Не удалось сохранить')
      } else {
        setSavedId(id)
      }
    } catch {
      setSelected(prev)
      setError('Ошибка соединения')
    } finally {
      setSavingId(null)
    }
  }

  return (
    <>
      <div className="preset-grid">
        {THEME_PRESETS.map((p) => {
          const active = p.id === selected
          return (
            <button
              key={p.id}
              type="button"
              className={`preset-card${active ? ' is-active' : ''}`}
              onClick={() => choose(p.id)}
              aria-pressed={active}
            >
              <div className="preset-card__head">
                <div className="preset-card__title">
                  <span className="preset-card__name">{p.name}</span>
                  <span className="preset-card__en">{p.subtitleEn}</span>
                </div>
                <span className="preset-card__badge">
                  {savingId === p.id ? (
                    <Loader2 size={14} className="spin" />
                  ) : active ? (
                    <Check size={14} />
                  ) : null}
                </span>
              </div>

              <div className="preset-card__swatches">
                <Swatch colors={p.dark} label={p.darkName} />
                <Swatch colors={p.light} label={p.lightName} />
              </div>

              <div className="preset-card__fonts">
                <span
                  className="preset-card__font-head"
                  style={{ fontFamily: FONT_STACK[p.fonts.heading] }}
                >
                  Заголовок
                </span>
                <span
                  className="preset-card__font-body"
                  style={{ fontFamily: FONT_STACK[p.fonts.body] }}
                >
                  Основной текст статьи — как читается абзац.
                </span>
                <span className="preset-card__font-meta">
                  {FONT_LABEL[p.fonts.heading]} / {FONT_LABEL[p.fonts.body]}
                </span>
              </div>

              <div className="preset-card__niche">
                <span className="preset-card__niche-k">Подойдёт для:</span> {p.niche}
              </div>
            </button>
          )
        })}
      </div>

      <div className="preset-status">
        {savedId && !error && (
          <span className="settings__saved">
            <Check size={15} /> Тема сохранена — применится на сайте
          </span>
        )}
        {error && <span className="settings__err">{error}</span>}
      </div>
    </>
  )
}
