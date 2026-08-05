'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Loader2, Pencil, Trash2, GripVertical, X, Lock, Unlock } from 'lucide-react'
import { StudioSelect } from '../../_ui/StudioSelect'
import { TiptapEditor } from '../../posts/new/TiptapEditor'

export type ChapterItem = {
  id: number | string
  title: string
  order: number
  isPreview: boolean
  minTierId: string
  wordCount: number | null
  bodyHtml: string
}
type Tier = { id: number | string; name: string }

/** Главы книги: список с drag-переупорядочиванием + модалка редактора главы. */
export function ChaptersManager({
  bookId, initialChapters, tiers,
}: {
  bookId: number | string
  initialChapters: ChapterItem[]
  tiers: Tier[]
}) {
  const router = useRouter()
  const [chapters, setChapters] = useState<ChapterItem[]>(initialChapters)
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [editing, setEditing] = useState<ChapterItem | 'new' | null>(null)
  const [savingOrder, setSavingOrder] = useState(false)

  async function persistOrder(next: ChapterItem[]) {
    setSavingOrder(true)
    try {
      await fetch('/studio/api/chapters/reorder', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookId, orderedIds: next.map((c) => c.id) }),
      })
    } finally { setSavingOrder(false) }
  }

  function onDrop(target: number) {
    if (dragIdx === null || dragIdx === target) { setDragIdx(null); return }
    const next = [...chapters]
    const [moved] = next.splice(dragIdx, 1)
    next.splice(target, 0, moved)
    next.forEach((c, i) => (c.order = i + 1))
    setChapters(next)
    setDragIdx(null)
    persistOrder(next)
  }

  async function remove(c: ChapterItem) {
    if (!confirm(`Удалить главу «${c.title}»?`)) return
    const res = await fetch('/studio/api/chapters/delete', {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: c.id }),
    })
    if (res.ok) { setChapters(chapters.filter((x) => x.id !== c.id)); router.refresh() }
    else { const j = await res.json().catch(() => ({})); alert(j.error || 'Не удалось удалить') }
  }

  return (
    <div className="c-card" style={{ padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 16 }}>Главы</div>
        {savingOrder && <span style={{ fontSize: 12, color: 'var(--st-text-muted)', display: 'inline-flex', gap: 4, alignItems: 'center' }}><Loader2 size={12} className="spin" /> сохраняю порядок…</span>}
        <button className="studio-btn studio-btn--primary" style={{ marginLeft: 'auto' }} onClick={() => setEditing('new')}>
          <Plus size={16} /> Добавить главу
        </button>
      </div>

      {chapters.length === 0 ? (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--st-text-muted)' }}>Глав пока нет. Добавьте первую.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {chapters.map((c, i) => (
            <div
              key={c.id}
              draggable
              onDragStart={() => setDragIdx(i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDrop(i)}
              onDragEnd={() => setDragIdx(null)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10,
                border: '1px solid var(--st-border)', background: dragIdx === i ? 'var(--st-surface-hover)' : 'var(--st-surface)',
              }}
            >
              <span style={{ cursor: 'grab', color: 'var(--st-text-muted)' }} title="Перетащите для порядка"><GripVertical size={16} /></span>
              <span style={{ fontSize: 13, color: 'var(--st-text-muted)', width: 28, textAlign: 'right' }}>{c.order}.</span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.title}</div>
                <div style={{ fontSize: 12, color: 'var(--st-text-muted)', display: 'flex', gap: 10, alignItems: 'center' }}>
                  {c.isPreview ? <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}><Unlock size={12} /> бесплатно</span>
                    : c.minTierId ? <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}><Lock size={12} /> платно</span> : null}
                  {c.wordCount != null && <span>{c.wordCount} слов</span>}
                </div>
              </div>
              <button className="studio-btn studio-btn--ghost" onClick={() => setEditing(c)}><Pencil size={14} /> Изменить</button>
              <button className="studio-btn studio-btn--ghost" onClick={() => remove(c)} title="Удалить"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <ChapterModal
          bookId={bookId}
          chapter={editing === 'new' ? null : editing}
          tiers={tiers}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); router.refresh() }}
        />
      )}
    </div>
  )
}

function ChapterModal({
  bookId, chapter, tiers, onClose, onSaved,
}: {
  bookId: number | string
  chapter: ChapterItem | null
  tiers: Tier[]
  onClose: () => void
  onSaved: () => void
}) {
  const [title, setTitle] = useState(chapter?.title || '')
  const [bodyHtml, setBodyHtml] = useState(chapter?.bodyHtml || '')
  const [isPreview, setIsPreview] = useState(chapter?.isPreview || false)
  const [minTierId, setMinTierId] = useState(chapter?.minTierId || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    if (!title.trim()) { setError('Укажите заголовок главы'); return }
    setBusy(true); setError(null)
    try {
      const endpoint = chapter ? '/studio/api/chapters/update' : '/studio/api/chapters/create'
      const payload = chapter
        ? { id: chapter.id, title: title.trim(), body: bodyHtml, isPreview, minTierId: minTierId || '' }
        : { bookId, title: title.trim(), body: bodyHtml, isPreview, minTierId: minTierId || '' }
      const res = await fetch(endpoint, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) { setError(json.error || 'Не удалось сохранить'); setBusy(false); return }
      onSaved()
    } catch { setError('Ошибка соединения'); setBusy(false) }
  }

  return (
    <div role="dialog" aria-modal="true"
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'grid', placeItems: 'start center', padding: 16, overflow: 'auto', zIndex: 50 }}
      onClick={onClose}>
      <div className="c-card" style={{ width: 'min(760px, 100%)', padding: 20, margin: '24px 0', display: 'flex', flexDirection: 'column', gap: 12 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{chapter ? 'Изменить главу' : 'Новая глава'}</div>
          <button className="studio-btn studio-btn--ghost" onClick={onClose} aria-label="Закрыть"><X size={16} /></button>
        </div>
        <input className="studio-input" placeholder="Заголовок главы" value={title} onChange={(e) => setTitle(e.target.value)} />
        <div>
          <div style={{ fontSize: 13, color: 'var(--st-text-muted)', marginBottom: 4 }}>Текст главы</div>
          <TiptapEditor initialHtml={chapter?.bodyHtml || ''} onChange={setBodyHtml} placeholder="Текст главы…" />
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
            <input type="checkbox" checked={isPreview} onChange={(e) => setIsPreview(e.target.checked)} /> Бесплатная глава
          </label>
          <div style={{ minWidth: 220, flex: 1 }}>
            <StudioSelect value={minTierId} onChange={setMinTierId} ariaLabel="Уровень (переопределение)"
              options={[{ value: '', label: 'Уровень как у книги' }, ...tiers.map((t) => ({ value: String(t.id), label: `${t.name} и выше` }))]} />
          </div>
        </div>
        {error && <div className="studio-login__error">{error}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="studio-btn studio-btn--ghost" onClick={onClose} disabled={busy}>Отмена</button>
          <button className="studio-btn studio-btn--primary" onClick={save} disabled={busy}>
            {busy ? <Loader2 size={16} className="spin" /> : null} Сохранить главу
          </button>
        </div>
      </div>
    </div>
  )
}
