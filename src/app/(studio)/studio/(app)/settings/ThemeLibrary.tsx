'use client'

import React, { useState } from 'react'
import { Check, Loader2, Plus, Trash2, Pencil, X, Palette } from 'lucide-react'
import { THEME_PRESETS, type PresetColors } from '@/lib/themePresets'
import { StudioSelect } from '../_ui/StudioSelect'

/**
 * Библиотека своих тем (Студия → Оформление). Автор собирает палитру (цвета для
 * тёмной и светлой версий), сохраняет её как именованную тему и активирует —
 * активная перекрывает цвета пресета/шаблона. Шрифты в MVP остаются от пресета.
 *
 * Контролы — в фирменном стиле студии: StudioSelect вместо нативного <select>,
 * studio-input для полей, свотч поверх скрытого color-input (нативная пипетка
 * ОС остаётся — её вид системный, но триггер брендированный).
 */

type Colors5 = { bg: string; surface: string; primary: string; accent: string; text: string }
type ThemeData = { dark: Colors5; light: Colors5 }
type CustomTheme = { id: number; name: string; theme: ThemeData }

const TOKENS: { key: keyof Colors5; label: string }[] = [
  { key: 'bg', label: 'Фон' },
  { key: 'surface', label: 'Карточки' },
  { key: 'primary', label: 'Акцент' },
  { key: 'accent', label: 'Второй акцент' },
  { key: 'text', label: 'Текст' },
]

const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i
const PRESET_OPTIONS = THEME_PRESETS.map((p) => ({ value: p.id, label: p.name }))

function pick5(c: PresetColors): Colors5 {
  return { bg: c.bg, surface: c.surface, primary: c.primary, accent: c.accent, text: c.text }
}

function seedFrom(id: string): ThemeData {
  const p = THEME_PRESETS.find((x) => x.id === id) ?? THEME_PRESETS[0]
  return { dark: pick5(p.dark), light: pick5(p.light) }
}

function Swatch({ colors, label }: { colors: Colors5; label: string }) {
  return (
    <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid var(--st-border)', minWidth: 120 }}>
      <div style={{ background: colors.bg, padding: 10 }}>
        <div style={{ background: colors.surface, borderRadius: 8, padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 12, height: 12, borderRadius: 999, background: colors.primary, display: 'inline-block' }} />
          <span style={{ width: 12, height: 12, borderRadius: 999, background: colors.accent, display: 'inline-block' }} />
          <span style={{ marginLeft: 'auto', color: colors.text, fontWeight: 700, fontSize: 13 }}>Aa</span>
        </div>
      </div>
      <div style={{ background: colors.bg, color: colors.text, fontSize: 11, textAlign: 'center', padding: '4px 6px', opacity: 0.8 }}>{label}</div>
    </div>
  )
}

/** Строка цвета: подпись + фирменный свотч (скрытый нативный color-input) + hex. */
function ColorRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const valid = HEX_RE.test(value.trim())
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 9 }}>
      <span style={{ width: 104, fontSize: 13, color: 'var(--st-text-muted)' }}>{label}</span>
      <label
        style={{
          position: 'relative', width: 30, height: 30, flex: 'none', borderRadius: 8, cursor: 'pointer',
          background: valid ? value : 'var(--st-surface)',
          border: '1px solid var(--st-border)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.06)',
        }}
        aria-label={`${label}: выбрать цвет`}
      >
        <input
          type="color"
          value={valid ? value : '#000000'}
          onChange={(e) => onChange(e.target.value)}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, border: 0, padding: 0, cursor: 'pointer' }}
        />
      </label>
      <input
        className="studio-input"
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        style={{ width: 116, fontFamily: 'ui-monospace, monospace', textTransform: 'uppercase' }}
      />
    </div>
  )
}

export function ThemeLibrary({
  initialThemes,
  initialSource,
  initialActiveId,
}: {
  initialThemes: CustomTheme[]
  initialSource: 'preset' | 'custom'
  initialActiveId: number | null
}) {
  const [themes, setThemes] = useState<CustomTheme[]>(initialThemes)
  const [source, setSource] = useState<'preset' | 'custom'>(initialSource)
  const [activeId, setActiveId] = useState<number | null>(initialActiveId)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [seedId, setSeedId] = useState('')

  // Редактор: null — закрыт; { id? } — создание/редактирование.
  const [editing, setEditing] = useState<{ id?: number; name: string; theme: ThemeData } | null>(null)

  function openEditor(next: { id?: number; name: string; theme: ThemeData }) {
    setSeedId('')
    setError(null)
    setEditing(next)
  }

  async function call(url: string, method: string, body: unknown) {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(json.error || 'Не удалось выполнить')
    return json
  }

  async function activate(next: 'preset' | 'custom', id?: number) {
    setError(null)
    setBusy(next === 'custom' ? `act-${id}` : 'act-preset')
    try {
      await call('/studio/api/settings/custom-themes/activate', 'POST', next === 'custom' ? { source: 'custom', id } : { source: 'preset' })
      setSource(next)
      setActiveId(next === 'custom' ? id ?? null : null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setBusy(null)
    }
  }

  async function remove(id: number) {
    setError(null)
    setBusy(`del-${id}`)
    try {
      await call('/studio/api/settings/custom-themes', 'DELETE', { id })
      setThemes((list) => list.filter((t) => t.id !== id))
      if (activeId === id) {
        setSource('preset')
        setActiveId(null)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setBusy(null)
    }
  }

  async function saveEditor() {
    if (!editing) return
    const name = editing.name.trim()
    if (!name) {
      setError('Введите название темы')
      return
    }
    setError(null)
    setBusy('save')
    try {
      if (editing.id) {
        await call('/studio/api/settings/custom-themes', 'PATCH', { id: editing.id, name, theme: editing.theme })
        setThemes((list) => list.map((t) => (t.id === editing.id ? { ...t, name, theme: editing.theme } : t)))
      } else {
        const res = await call('/studio/api/settings/custom-themes', 'POST', { name, theme: editing.theme })
        const id = Number(res.id)
        if (Number.isFinite(id)) setThemes((list) => [...list, { id, name, theme: editing.theme }])
      }
      setEditing(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setBusy(null)
    }
  }

  function setColor(mode: 'dark' | 'light', key: keyof Colors5, v: string) {
    setEditing((ed) => (ed ? { ...ed, theme: { ...ed.theme, [mode]: { ...ed.theme[mode], [key]: v } } } : ed))
  }

  return (
    <section className="settings__block">
      <div className="settings__block-head">
        <h2>Свои темы</h2>
        <p>
          Соберите собственную палитру — цвета для тёмной и светлой версий сайта — и сохраните её как тему.
          Активная тема перекрывает цвета пресета. Шрифты пока берутся из выбранного пресета/шаблона.
        </p>
      </div>

      {source === 'custom' && (
        <div className="nl-policy" style={{ marginBottom: 12 }}>
          <Palette size={18} />
          <span>
            Сейчас активна ваша тема.{' '}
            <button
              type="button"
              onClick={() => activate('preset')}
              disabled={busy === 'act-preset'}
              style={{ background: 'none', border: 0, padding: 0, color: 'var(--st-primary)', cursor: 'pointer', textDecoration: 'underline', font: 'inherit' }}
            >
              Вернуть палитру пресета
            </button>
          </span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
        {themes.map((t) => {
          const isActive = source === 'custom' && activeId === t.id
          return (
            <div key={t.id} className="studio-card" style={{ padding: 12, border: isActive ? '2px solid var(--st-primary)' : undefined }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <strong style={{ fontSize: 14 }}>{t.name}</strong>
                {isActive && <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--st-primary)', fontSize: 12 }}><Check size={13} /> активна</span>}
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <Swatch colors={t.theme.dark} label="Тёмная" />
                <Swatch colors={t.theme.light} label="Светлая" />
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {!isActive && (
                  <button type="button" className="studio-btn studio-btn--primary" onClick={() => activate('custom', t.id)} disabled={busy === `act-${t.id}`}>
                    {busy === `act-${t.id}` ? <Loader2 size={13} className="spin" /> : 'Сделать активной'}
                  </button>
                )}
                <button type="button" className="studio-btn" onClick={() => openEditor({ id: t.id, name: t.name, theme: t.theme })}>
                  <Pencil size={13} /> Изменить
                </button>
                <button type="button" className="studio-btn" onClick={() => remove(t.id)} disabled={busy === `del-${t.id}`} aria-label="Удалить тему">
                  {busy === `del-${t.id}` ? <Loader2 size={13} className="spin" /> : <Trash2 size={13} />}
                </button>
              </div>
            </div>
          )
        })}

        <button
          type="button"
          className="studio-card"
          onClick={() => openEditor({ name: '', theme: seedFrom(THEME_PRESETS[0].id) })}
          style={{ padding: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 150, border: '1px dashed var(--st-border)', cursor: 'pointer', color: 'var(--st-text-muted)' }}
        >
          <Plus size={22} />
          <span>Создать тему</span>
        </button>
      </div>

      {error && <div className="settings__err" style={{ marginTop: 10 }}>{error}</div>}

      {editing && (
        <div className="studio-card" style={{ marginTop: 16, padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <strong>{editing.id ? 'Редактирование темы' : 'Новая тема'}</strong>
            <button type="button" onClick={() => setEditing(null)} style={{ marginLeft: 'auto', background: 'none', border: 0, cursor: 'pointer', color: 'var(--st-text-muted)' }} aria-label="Закрыть">
              <X size={18} />
            </button>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 18 }}>
            <label className="studio-field" style={{ flex: '1 1 240px', maxWidth: 340 }}>
              <span className="studio-field__label">Название</span>
              <input
                className="studio-input"
                type="text"
                value={editing.name}
                onChange={(e) => setEditing((ed) => (ed ? { ...ed, name: e.target.value } : ed))}
                placeholder="Например, «Мятная ночь»"
                maxLength={60}
              />
            </label>
            {/* НЕ <label>: обёртка label пробрасывает клик по опции на триггер
                селекта, и он тут же переоткрывается. */}
            <div className="studio-field" style={{ flex: '0 1 240px' }}>
              <span className="studio-field__label">Взять за основу</span>
              <StudioSelect
                value={seedId}
                onChange={(v) => { setSeedId(v); if (v) setEditing((ed) => (ed ? { ...ed, theme: seedFrom(v) } : ed)) }}
                options={PRESET_OPTIONS}
                placeholder="— выбрать пресет —"
                ariaLabel="Взять палитру за основу"
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
            {(['dark', 'light'] as const).map((mode) => (
              <div key={mode}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <strong style={{ fontSize: 13 }}>{mode === 'dark' ? 'Тёмная версия' : 'Светлая версия'}</strong>
                  <div style={{ marginLeft: 'auto' }}>
                    <Swatch colors={editing.theme[mode]} label={mode === 'dark' ? 'Тёмная' : 'Светлая'} />
                  </div>
                </div>
                {TOKENS.map((tok) => (
                  <ColorRow
                    key={tok.key}
                    label={tok.label}
                    value={editing.theme[mode][tok.key]}
                    onChange={(v) => setColor(mode, tok.key, v)}
                  />
                ))}
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
            <button type="button" className="studio-btn studio-btn--primary" onClick={saveEditor} disabled={busy === 'save'}>
              {busy === 'save' ? <Loader2 size={14} className="spin" /> : 'Сохранить тему'}
            </button>
            <button type="button" className="studio-btn" onClick={() => setEditing(null)}>Отмена</button>
          </div>
        </div>
      )}
    </section>
  )
}
