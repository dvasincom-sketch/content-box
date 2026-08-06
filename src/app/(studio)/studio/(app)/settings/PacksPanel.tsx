'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Check, LayoutTemplate, Palette, Layers } from 'lucide-react'
import { HOME_PACKS } from '@/lib/homePacks'
import { THEME_PRESETS } from '@/lib/themePresets'

type Mode = 'overwrite' | 'merge'

/** id пресета → человекочитаемое имя (для карточки). */
const PRESET_NAME: Record<string, string> = Object.fromEntries(THEME_PRESETS.map((p) => [p.id, p.name]))

/**
 * Панель «Шаблоны»: карточки паков главной. Каждая карточка показывает, ЧТО пак
 * поставит (тема + список секций), чтобы выбор был очевиден. Клик «Применить» →
 * диалог выбора режима (перезаписать / добавить недостающее). Стили инлайновые
 * (токены --st-*), чтобы не трогать studio.css.
 */
export function PacksPanel() {
  const router = useRouter()
  const [dialogPack, setDialogPack] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [doneId, setDoneId] = useState<string | null>(null)

  const pending = HOME_PACKS.find((p) => p.id === dialogPack) || null

  async function apply(packId: string, mode: Mode) {
    setError(null)
    setBusy(true)
    try {
      const res = await fetch('/studio/api/settings/apply-pack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ packId, mode }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(j.error || 'Не удалось применить шаблон')
        setBusy(false)
        return
      }
      setBusy(false)
      setDialogPack(null)
      setDoneId(packId)
      router.refresh()
    } catch {
      setError('Ошибка соединения')
      setBusy(false)
    }
  }

  return (
    <div className="packs">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
        {HOME_PACKS.map((p) => {
          const sectionCount = p.sections.filter((s) => s.enabled).length
          return (
            <div
              key={p.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                padding: 14,
                borderRadius: 14,
                border: '1px solid var(--st-border, rgba(255,255,255,0.12))',
                background: 'var(--st-surface, #16161a)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, color: 'var(--st-text)' }}>
                <LayoutTemplate size={18} />
                <span style={{ fontWeight: 600, fontSize: 15 }}>{p.name}</span>
              </div>
              <p
                style={{
                  fontSize: 13,
                  color: 'var(--st-text-muted)',
                  margin: '6px 0 12px',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {p.description}
              </p>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 12, color: 'var(--st-text-muted)', marginBottom: 14 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 999, border: '1px solid var(--st-border)', color: 'var(--st-text)' }}>
                  <Palette size={13} /> {PRESET_NAME[p.themePreset] || p.themePreset}
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <Layers size={13} /> {sectionCount} секций
                </span>
              </div>

              <button
                className="studio-btn studio-btn--primary"
                style={{ marginTop: 'auto' }}
                onClick={() => {
                  setError(null)
                  setDialogPack(p.id)
                }}
              >
                {doneId === p.id ? (
                  <>
                    <Check size={16} /> Применён
                  </>
                ) : (
                  'Применить'
                )}
              </button>
            </div>
          )
        })}
      </div>

      {error && !pending && <div className="settings__err" style={{ marginTop: 12 }}>{error}</div>}

      {pending && (
        <div
          onClick={() => !busy && setDialogPack(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            style={{
              width: '100%',
              maxWidth: 460,
              background: 'var(--st-surface, #16161a)',
              border: '1px solid var(--st-border, rgba(255,255,255,0.12))',
              borderRadius: 16,
              padding: 20,
              boxShadow: '0 20px 50px rgba(0,0,0,0.4)',
            }}
          >
            <h3 style={{ margin: '0 0 10px', fontSize: 17, fontWeight: 700, color: 'var(--st-text)' }}>
              Применить «{pending.name}»
            </h3>
            <p style={{ margin: '0 0 6px', fontSize: 14, color: 'var(--st-text)' }}>
              <strong>Перезаписать</strong> — заменит тему, набор и порядок секций и стартовые тексты hero/баннера
              на значения шаблона.
            </p>
            <p style={{ margin: '0 0 6px', fontSize: 14, color: 'var(--st-text-muted)' }}>
              <strong>Добавить недостающее</strong> — тему и тексты не трогает, лишь дописывает секции шаблона,
              которых сейчас нет.
            </p>
            <p style={{ margin: '0 0 4px', fontSize: 12, color: 'var(--st-text-muted)' }}>
              Секции с данными (категории, ленты, постеры) наполняются реальным контентом проекта — на пустом
              проекте они автоматически скрыты, пока контента нет.
            </p>
            {error && <div className="settings__err" style={{ margin: '10px 0 0' }}>{error}</div>}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end', marginTop: 16 }}>
              <button className="studio-btn studio-btn--ghost" onClick={() => setDialogPack(null)} disabled={busy}>
                Отмена
              </button>
              <button className="studio-btn studio-btn--ghost" onClick={() => apply(pending.id, 'merge')} disabled={busy}>
                Добавить недостающее
              </button>
              <button className="studio-btn studio-btn--primary" onClick={() => apply(pending.id, 'overwrite')} disabled={busy}>
                {busy ? <Loader2 size={16} className="spin" /> : null} Перезаписать
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
