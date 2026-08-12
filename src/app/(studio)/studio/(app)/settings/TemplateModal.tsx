'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Loader2, Check, Palette } from 'lucide-react'
import { THEME_PRESETS, type PresetColors } from '@/lib/themePresets'
import { HOME_SECTION_DEFS, type HomeSectionType } from '@/lib/homeSections'
import { HOME_SECTION_CATALOG } from '@/lib/homeSectionCatalog'
import type { HomePackSection } from '@/lib/homePacks'

/** type → лейбл и «зачем» (из каталога секций). */
const LABEL: Record<string, string> = Object.fromEntries(HOME_SECTION_DEFS.map((d) => [d.type, d.label]))
const WHY: Record<string, string> = Object.fromEntries(HOME_SECTION_CATALOG.map((e) => [e.type, e.description]))

export type ModalTemplate = {
  source: 'base' | 'user'
  id: string
  name: string
  verb?: string
  description?: string
  themePreset: string
  sections: HomePackSection[]
}

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

/**
 * Окно шаблона: показывает состав секций (с пояснением «зачем») и выбор темы,
 * затем применяет. Базовый шаблон — перезапись/добавление недостающего; свой —
 * перезапись. Тема выбирается ЗДЕСЬ (отдельного блока «Тема сайта» больше нет).
 */
export function TemplateModal({
  tpl,
  onClose,
  onApplied,
}: {
  tpl: ModalTemplate
  onClose: () => void
  onApplied: () => void
}) {
  const [theme, setTheme] = useState(tpl.themePreset)
  const [busy, setBusy] = useState<null | string>(null)
  const [error, setError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const sections = tpl.sections.filter((s) => s.enabled !== false)

  async function apply(mode: 'overwrite' | 'merge' | 'theme') {
    setError(null)
    setBusy(mode)
    try {
      const url = tpl.source === 'user' ? '/studio/api/settings/templates' : '/studio/api/settings/apply-pack'
      const body =
        tpl.source === 'user'
          ? { action: 'apply', id: tpl.id, themePreset: theme }
          : { packId: tpl.id, mode, themePreset: theme }
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(j.error || 'Не удалось применить')
        setBusy(null)
        return
      }
      onApplied()
    } catch {
      setError('Ошибка соединения')
      setBusy(null)
    }
  }

  const panel = (
    <div
      className="studio-portal"
      onClick={() => !busy && onClose()}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        style={{
          width: '100%', maxWidth: 720, maxHeight: 'calc(100% - 48px)', overflow: 'auto',
          background: 'var(--st-surface)', border: '1px solid var(--st-border-strong)',
          borderRadius: 16, boxShadow: '0 20px 50px rgba(0,0,0,0.4)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, padding: '18px 20px', borderBottom: '1px solid var(--st-border)' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--st-text)' }}>{tpl.name}</h3>
              {tpl.verb && (
                <span style={{ fontSize: 12, fontWeight: 600, padding: '2px 9px', borderRadius: 999, border: '1px solid var(--st-border)', color: 'var(--st-text-muted)' }}>
                  {tpl.verb}
                </span>
              )}
            </div>
            {tpl.description && <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--st-text-muted)', maxWidth: '60ch' }}>{tpl.description}</p>}
          </div>
          <button className="catmgr__icon-btn" onClick={onClose} title="Закрыть"><X size={18} /></button>
        </div>

        <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Секции: что внутри и зачем */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--st-text)', marginBottom: 10 }}>
              Секции ({sections.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {sections.map((s, i) => (
                <div key={`${s.type}-${i}`} style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--st-text)', minWidth: 150, flexShrink: 0 }}>
                    {LABEL[s.type] || s.type}
                    {s.config?.heading ? <span style={{ color: 'var(--st-text-muted)', fontWeight: 400 }}> · «{s.config.heading}»</span> : null}
                  </span>
                  <span style={{ fontSize: 12.5, color: 'var(--st-text-muted)', lineHeight: 1.4 }}>{WHY[s.type] || ''}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Выбор темы */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--st-text)', marginBottom: 10 }}>
              <Palette size={15} /> Тема оформления
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 10 }}>
              {THEME_PRESETS.map((p) => {
                const active = p.id === theme
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setTheme(p.id)}
                    style={{
                      textAlign: 'left', cursor: 'pointer', padding: 8, borderRadius: 12,
                      background: 'var(--st-surface-2)',
                      border: `1px solid ${active ? 'var(--st-accent)' : 'var(--st-border)'}`,
                      boxShadow: active ? '0 0 0 1px var(--st-accent)' : 'none',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 6 }}>
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--st-text)' }}>{p.name}</span>
                      {active && <Check size={14} style={{ color: 'var(--st-text)', flexShrink: 0 }} />}
                    </div>
                    <div className="preset-card__swatches">
                      <Swatch colors={p.dark} label={p.darkName} />
                      <Swatch colors={p.light} label={p.lightName} />
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {error && <div className="settings__err">{error}</div>}
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end', padding: '14px 20px', borderTop: '1px solid var(--st-border)' }}>
          <button className="studio-btn studio-btn--ghost" onClick={onClose} disabled={!!busy}>Отмена</button>
          {tpl.source === 'base' ? (
            <>
              <button
                className="studio-btn studio-btn--ghost"
                onClick={() => apply('theme')}
                disabled={!!busy}
                title="Только оформление: цвета, шрифты, фон. Секции конструктора главной не меняются."
              >
                {busy === 'theme' ? <Loader2 size={16} className="spin" /> : null} Применить оформление
              </button>
              <button
                className="studio-btn studio-btn--primary"
                onClick={() => apply('merge')}
                disabled={!!busy}
                title="Оформление + недостающие секции добавляются в конструктор главной. Существующие секции и тексты не удаляются."
              >
                {busy === 'merge' ? <Loader2 size={16} className="spin" /> : <Check size={16} />}
                Оформление и секции
              </button>
            </>
          ) : (
            <button className="studio-btn studio-btn--primary" onClick={() => apply('overwrite')} disabled={!!busy}>
              {busy === 'overwrite' ? <Loader2 size={16} className="spin" /> : <Check size={16} />}
              Применить
            </button>
          )}
        </div>
      </div>
    </div>
  )

  if (!mounted) return null
  return createPortal(panel, document.body)
}
