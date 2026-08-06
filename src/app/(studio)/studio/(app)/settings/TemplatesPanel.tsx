'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { LayoutTemplate, Palette, Layers, Check, Plus, Pencil, Trash2, Loader2, Bookmark } from 'lucide-react'
import { HOME_PACKS, type HomeSavedTemplate } from '@/lib/homePacks'
import { THEME_PRESETS } from '@/lib/themePresets'
import { TemplateModal, type ModalTemplate } from './TemplateModal'
import { ConfirmDialog } from './ConfirmDialog'

const PRESET_NAME: Record<string, string> = Object.fromEntries(THEME_PRESETS.map((p) => [p.id, p.name]))

/** Компактная карточка шаблона (базового или своего). */
function Card({
  title, subtitle, description, themePreset, sectionCount, active, onOpen, actions,
}: {
  title: string
  subtitle?: string
  description?: string
  themePreset: string
  sectionCount: number
  active?: boolean
  onOpen: () => void
  actions?: React.ReactNode
}) {
  return (
    <div
      style={{
        display: 'flex', flexDirection: 'column', padding: 14, borderRadius: 14,
        border: `1px solid ${active ? 'var(--st-accent)' : 'var(--st-border)'}`,
        background: 'var(--st-surface)',
        boxShadow: active ? '0 0 0 1px var(--st-accent)' : 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, color: 'var(--st-text)' }}>
        <LayoutTemplate size={18} />
        <span style={{ fontWeight: 600, fontSize: 15 }}>{title}</span>
        {subtitle && (
          <span style={{ fontSize: 11.5, fontWeight: 600, padding: '1px 8px', borderRadius: 999, border: '1px solid var(--st-border)', color: 'var(--st-text-muted)' }}>
            {subtitle}
          </span>
        )}
        {active && <span title="Применён" style={{ marginLeft: 'auto', display: 'inline-flex' }}><Check size={15} style={{ color: 'var(--st-text)' }} /></span>}
      </div>
      {description && (
        <p style={{ fontSize: 13, color: 'var(--st-text-muted)', margin: '0 0 12px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {description}
        </p>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 12, color: 'var(--st-text-muted)', marginBottom: 14 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 999, border: '1px solid var(--st-border)', color: 'var(--st-text)' }}>
          <Palette size={13} /> {PRESET_NAME[themePreset] || themePreset}
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <Layers size={13} /> {sectionCount} секций
        </span>
      </div>
      <div style={{ marginTop: 'auto', display: 'flex', gap: 8 }}>
        <button className="studio-btn studio-btn--primary" style={{ flex: 1 }} onClick={onOpen}>Открыть</button>
        {actions}
      </div>
    </div>
  )
}

/**
 * Шаблоны главной (вкладка «Оформление»). Базовые паки + «Мои шаблоны».
 * Клик по карточке → окно (состав секций + выбор темы + применить). Тема
 * выбирается только здесь — отдельного блока «Тема сайта» больше нет.
 * «Сохранить текущую как свой шаблон» фиксирует текущую главную под своим именем.
 */
export function TemplatesPanel({
  savedTemplates,
  appliedTemplate,
}: {
  savedTemplates: HomeSavedTemplate[]
  appliedTemplate: string | null
}) {
  const router = useRouter()
  const [modal, setModal] = useState<ModalTemplate | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nameModal, setNameModal] = useState<{ title: string; initial: string; submit: (v: string) => void } | null>(null)
  const [confirm, setConfirm] = useState<{ message: string; onYes: () => void } | null>(null)

  async function op(body: Record<string, unknown>) {
    setError(null)
    setBusy(true)
    try {
      const res = await fetch('/studio/api/settings/templates', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify(body),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { setError(j.error || 'Не удалось выполнить'); setBusy(false); return false }
      setBusy(false)
      router.refresh()
      return true
    } catch {
      setError('Ошибка соединения'); setBusy(false); return false
    }
  }

  function saveCurrent() {
    setNameModal({ title: 'Название своего шаблона', initial: '', submit: (name) => op({ action: 'save', name }) })
  }
  function rename(t: HomeSavedTemplate) {
    setNameModal({
      title: 'Новое название шаблона',
      initial: t.name,
      submit: (name) => { if (name !== t.name) op({ action: 'rename', id: t.id, name }) },
    })
  }
  function remove(t: HomeSavedTemplate) {
    setConfirm({ message: `Удалить свой шаблон «${t.name}»? Это не меняет текущую главную.`, onYes: () => op({ action: 'delete', id: t.id }) })
  }

  const grid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }

  return (
    <div className="packs">
      <div style={grid}>
        {HOME_PACKS.map((p) => (
          <Card
            key={p.id}
            title={p.name}
            subtitle={p.verb}
            description={p.description}
            themePreset={p.themePreset}
            sectionCount={p.sections.filter((s) => s.enabled).length}
            active={appliedTemplate === p.id}
            onOpen={() => setModal({ source: 'base', id: p.id, name: p.name, verb: p.verb, description: p.description, themePreset: p.themePreset, sections: p.sections })}
          />
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', margin: '20px 0 10px' }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--st-text)' }}>Мои шаблоны</h3>
        <button className="studio-btn studio-btn--ghost" onClick={saveCurrent} disabled={busy}>
          {busy ? <Loader2 size={16} className="spin" /> : <Bookmark size={16} />} Сохранить текущую как свой шаблон
        </button>
      </div>
      <p className="settings__hint" style={{ marginTop: 0 }}>
        Применили базовый шаблон и настроили главную под себя? Сохраните её как свой шаблон — потом примените в один клик.
      </p>

      {savedTemplates.length === 0 ? (
        <div className="settings__hint" style={{ padding: '14px 0' }}>Своих шаблонов пока нет.</div>
      ) : (
        <div style={grid}>
          {savedTemplates.map((t) => (
            <Card
              key={t.id}
              title={t.name}
              themePreset={t.themePreset}
              sectionCount={t.sections.filter((s) => s.enabled !== false).length}
              active={appliedTemplate === t.id}
              onOpen={() => setModal({ source: 'user', id: t.id, name: t.name, themePreset: t.themePreset, sections: t.sections })}
              actions={
                <>
                  <button className="catmgr__icon-btn" onClick={() => rename(t)} title="Переименовать" disabled={busy}><Pencil size={15} /></button>
                  <button className="catmgr__icon-btn catmgr__icon-btn--danger" onClick={() => remove(t)} title="Удалить" disabled={busy}><Trash2 size={15} /></button>
                </>
              }
            />
          ))}
        </div>
      )}

      {error && <div className="settings__err" style={{ marginTop: 12 }}>{error}</div>}

      {modal && (
        <TemplateModal
          tpl={modal}
          onClose={() => setModal(null)}
          onApplied={() => { setModal(null); router.refresh() }}
        />
      )}

      {nameModal && (
        <NamePromptModal
          title={nameModal.title}
          initial={nameModal.initial}
          busy={busy}
          onCancel={() => setNameModal(null)}
          onSubmit={(v) => { nameModal.submit(v); setNameModal(null) }}
        />
      )}

      {confirm && (
        <ConfirmDialog
          title="Удалить шаблон"
          message={confirm.message}
          confirmLabel="Удалить"
          busy={busy}
          onConfirm={() => { confirm.onYes(); setConfirm(null) }}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  )
}

/** Студийная модалка ввода названия (замена window.prompt). */
function NamePromptModal({
  title, initial, busy, onCancel, onSubmit,
}: {
  title: string
  initial: string
  busy: boolean
  onCancel: () => void
  onSubmit: (v: string) => void
}) {
  const [v, setV] = useState(initial)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const val = v.trim()
  const body = (
    <div
      onClick={() => !busy && onCancel()}
      style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        style={{ width: '100%', maxWidth: 440, background: 'var(--st-surface)', border: '1px solid var(--st-border-strong)', borderRadius: 16, boxShadow: '0 20px 50px rgba(0,0,0,0.4)', padding: 20 }}
      >
        <label className="studio-field" style={{ display: 'block' }}>
          <span className="studio-field__label" style={{ display: 'block', marginBottom: 8 }}>{title}</span>
          <input
            className="studio-input"
            autoFocus
            value={v}
            maxLength={60}
            placeholder="Например, «Моя главная»"
            onChange={(e) => setV(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && val) onSubmit(val) }}
          />
        </label>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button className="studio-btn studio-btn--ghost" onClick={onCancel} disabled={busy}>Отмена</button>
          <button className="studio-btn studio-btn--primary" onClick={() => val && onSubmit(val)} disabled={busy || !val}>
            {busy ? <Loader2 size={16} className="spin" /> : null} Сохранить
          </button>
        </div>
      </div>
    </div>
  )

  if (!mounted) return null
  return createPortal(body, document.body)
}
