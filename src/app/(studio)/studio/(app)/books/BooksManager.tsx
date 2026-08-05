'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { BookOpen, Plus, Loader2, Pencil, Trash2 } from 'lucide-react'
import { StudioSelect } from '../_ui/StudioSelect'

type Book = {
  id: number | string
  title: string
  status: string
  statusLabel: string
  type: string
  typeLabel: string
  coverUrl: string | null
  chapters: number
  updatedAt: string | null
}

const STATUS_COLOR: Record<string, string> = {
  ongoing: 'color-mix(in srgb, #3b82f6 20%, transparent)',
  finished: 'color-mix(in srgb, #22c55e 20%, transparent)',
  frozen: 'color-mix(in srgb, #94a3b8 24%, transparent)',
}
const TYPE_OPTIONS = [
  { value: 'novel', label: 'Роман' },
  { value: 'story', label: 'Рассказ' },
  { value: 'mini', label: 'Миниатюра' },
  { value: 'cycle', label: 'Цикл' },
]
const FILTERS = [{ value: 'all', label: 'Все' }, ...TYPE_OPTIONS]

/** Список книг + создание. Правка книги — на отдельной странице /studio/books/[id]. */
export function BooksManager({ initialBooks }: { initialBooks: Book[] }) {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [newType, setNewType] = useState('novel')
  const [filter, setFilter] = useState('all')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function create() {
    const t = title.trim()
    if (!t) { setError('Укажите название'); return }
    setBusy(true); setError(null)
    try {
      const res = await fetch('/studio/api/books/create', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: t, type: newType }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) { setError(json.error || 'Не удалось создать'); setBusy(false); return }
      router.push(`/studio/books/${json.id}`)
    } catch { setError('Ошибка соединения'); setBusy(false) }
  }

  async function remove(b: Book) {
    if (!confirm(`Удалить книгу «${b.title}» вместе со всеми главами?`)) return
    try {
      const res = await fetch('/studio/api/books/delete', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: b.id }),
      })
      if (res.ok) router.refresh()
      else { const j = await res.json().catch(() => ({})); alert(j.error || 'Не удалось удалить') }
    } catch { alert('Ошибка соединения') }
  }

  const shown = filter === 'all' ? initialBooks : initialBooks.filter((b) => b.type === filter)

  return (
    <div className="studio-page">
      <div className="studio-page-head"><h1>Произведения</h1></div>

      <div className="studio-card" style={{ padding: 16, marginBottom: 20, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          className="studio-input" placeholder="Название нового произведения" value={title}
          onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && create()}
          style={{ flex: 1, minWidth: 200 }}
        />
        <div style={{ width: 160 }}>
          <StudioSelect value={newType} onChange={setNewType} options={TYPE_OPTIONS} ariaLabel="Тип произведения" />
        </div>
        <button className="studio-btn studio-btn--primary" onClick={create} disabled={busy}>
          {busy ? <Loader2 size={16} className="spin" /> : <Plus size={16} />} Создать
        </button>
      </div>
      {error && <div className="studio-login__error" style={{ marginBottom: 12 }}>{error}</div>}

      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`studio-btn ${filter === f.value ? 'studio-btn--primary' : 'studio-btn--ghost'}`}
            style={{ padding: '6px 14px' }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div className="studio-empty">
          <div className="studio-empty__icon"><BookOpen size={28} /></div>
          <div className="studio-empty__title">Произведений пока нет</div>
          <div className="studio-empty__text">Создайте первое произведение выше.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {shown.map((b) => (
            <div key={b.id} className="studio-card" style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 'none', width: 46, height: 62, borderRadius: 6, overflow: 'hidden', background: 'var(--st-surface)', display: 'grid', placeItems: 'center' }}>
                {b.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={b.coverUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : <BookOpen size={18} style={{ color: 'var(--st-text-muted)' }} />}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: 600 }}>{b.title}</div>
                <div style={{ fontSize: 12, color: 'var(--st-text-muted)', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 2 }}>
                  <span style={{ padding: '1px 8px', borderRadius: 999, background: 'var(--st-surface-hover)', color: 'var(--st-text-muted)' }}>{b.typeLabel}</span>
                  <span style={{ padding: '1px 8px', borderRadius: 999, background: STATUS_COLOR[b.status] || 'transparent' }}>{b.statusLabel}</span>
                  <span>{b.chapters} глав</span>
                </div>
              </div>
              <Link href={`/studio/books/${b.id}`} className="studio-btn studio-btn--ghost"><Pencil size={14} /> Открыть</Link>
              <button className="studio-btn studio-btn--ghost" onClick={() => remove(b)} title="Удалить"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
