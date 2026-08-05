'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { BookOpen, Plus, Loader2, Pencil, Trash2 } from 'lucide-react'

type Book = {
  id: number | string
  title: string
  status: string
  statusLabel: string
  coverUrl: string | null
  chapters: number
  updatedAt: string | null
}

const STATUS_COLOR: Record<string, string> = {
  ongoing: 'color-mix(in srgb, #3b82f6 20%, transparent)',
  finished: 'color-mix(in srgb, #22c55e 20%, transparent)',
  frozen: 'color-mix(in srgb, #94a3b8 24%, transparent)',
}

/** Список книг + создание. Правка книги — на отдельной странице /studio/books/[id]. */
export function BooksManager({ initialBooks }: { initialBooks: Book[] }) {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function create() {
    const t = title.trim()
    if (!t) { setError('Укажите название'); return }
    setBusy(true); setError(null)
    try {
      const res = await fetch('/studio/api/books/create', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: t }),
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

  return (
    <div className="studio-page">
      <div className="studio-page-head"><h1>Книги</h1></div>

      <div className="c-card" style={{ padding: 16, marginBottom: 20, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          className="studio-input" placeholder="Название новой книги" value={title}
          onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && create()}
          style={{ flex: 1, minWidth: 220 }}
        />
        <button className="studio-btn studio-btn--primary" onClick={create} disabled={busy}>
          {busy ? <Loader2 size={16} className="spin" /> : <Plus size={16} />} Создать
        </button>
      </div>
      {error && <div className="studio-login__error" style={{ marginBottom: 12 }}>{error}</div>}

      {initialBooks.length === 0 ? (
        <div className="studio-empty">
          <div className="studio-empty__icon"><BookOpen size={28} /></div>
          <div className="studio-empty__title">Книг пока нет</div>
          <div className="studio-empty__text">Создайте первую книгу выше.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {initialBooks.map((b) => (
            <div key={b.id} className="c-card" style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 'none', width: 46, height: 62, borderRadius: 6, overflow: 'hidden', background: 'var(--st-surface, #eee)', display: 'grid', placeItems: 'center' }}>
                {b.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={b.coverUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : <BookOpen size={18} style={{ color: 'var(--st-text-muted)' }} />}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: 600 }}>{b.title}</div>
                <div style={{ fontSize: 12, color: 'var(--st-text-muted)', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 2 }}>
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
