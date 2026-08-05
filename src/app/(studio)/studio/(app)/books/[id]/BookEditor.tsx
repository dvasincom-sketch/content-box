'use client'

import React, { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2, ImagePlus, X, ArrowLeft, Save } from 'lucide-react'
import { StudioSelect } from '../../_ui/StudioSelect'
import { TiptapEditor } from '../../posts/new/TiptapEditor'
import { ChaptersManager, type ChapterItem } from './ChaptersManager'

type Tier = { id: number | string; name: string }
type Cat = { id: number | string; title: string; parentId: number | null }
type BookData = {
  id: number | string
  title: string
  slug: string
  status: string
  isAdult: boolean
  freeChapters: number
  categoryId: string
  minTierId: string
  coverId: number | null
  coverUrl: string | null
  annotationHtml: string
  tags: string[]
}

function categoryOptions(cats: Cat[]): { value: string; label: string; depth: number }[] {
  const present = new Set(cats.map((c) => Number(c.id)))
  const byParent = new Map<number | null, Cat[]>()
  for (const c of cats) {
    const pid = c.parentId != null && present.has(c.parentId) ? c.parentId : null
    if (!byParent.has(pid)) byParent.set(pid, [])
    byParent.get(pid)!.push(c)
  }
  for (const list of byParent.values()) list.sort((a, b) => String(a.title).localeCompare(String(b.title), 'ru'))
  const out: { value: string; label: string; depth: number }[] = []
  const walk = (parent: number | null, depth: number) => {
    for (const c of byParent.get(parent) ?? []) {
      out.push({ value: String(c.id), label: c.title, depth })
      walk(Number(c.id), depth + 1)
    }
  }
  walk(null, 0)
  return out
}

/** Редактор книги: метаданные (обложка/аннотация/статус/теги/гейтинг) + главы. */
export function BookEditor({
  book, chapters, tiers, categories,
}: {
  book: BookData
  chapters: ChapterItem[]
  tiers: Tier[]
  categories: Cat[]
}) {
  const router = useRouter()
  const [title, setTitle] = useState(book.title)
  const [status, setStatus] = useState(book.status)
  const [isAdult, setIsAdult] = useState(book.isAdult)
  const [freeChapters, setFreeChapters] = useState(String(book.freeChapters))
  const [categoryId, setCategoryId] = useState(book.categoryId)
  const [minTierId, setMinTierId] = useState(book.minTierId)
  const [coverId, setCoverId] = useState<number | null>(book.coverId)
  const [coverUrl, setCoverUrl] = useState<string | null>(book.coverUrl)
  const [annotationHtml, setAnnotationHtml] = useState(book.annotationHtml)
  const [tags, setTags] = useState<string[]>(book.tags)
  const [tagInput, setTagInput] = useState('')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const catOptions = useMemo(() => categoryOptions(categories), [categories])

  async function uploadCover(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      setUploading(true); setError(null)
      try {
        const fd = new FormData(); fd.append('file', file)
        const res = await fetch('/studio/api/upload-cover', { method: 'POST', credentials: 'include', body: fd })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) setError(json.error || 'Не удалось загрузить обложку')
        else { setCoverId(json.id); setCoverUrl(json.url) }
      } catch { setError('Ошибка соединения') } finally { setUploading(false) }
    }
    e.target.value = ''
  }

  function addTag() {
    const t = tagInput.trim()
    if (t && !tags.includes(t)) setTags([...tags, t])
    setTagInput('')
  }

  async function save() {
    if (!title.trim()) { setError('Укажите название'); return }
    setSaving(true); setError(null)
    try {
      const res = await fetch('/studio/api/books/update', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: book.id, title: title.trim(), annotation: annotationHtml, status, isAdult,
          freeChapters: Number(freeChapters) || 0, categoryId: categoryId || '', minTierId: minTierId || '',
          coverId: coverId ?? null, tags,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) { setError(json.error || 'Не удалось сохранить'); setSaving(false); return }
      setSavedAt(new Date().toLocaleTimeString('ru-RU'))
      router.refresh()
    } catch { setError('Ошибка соединения') } finally { setSaving(false) }
  }

  return (
    <div className="studio-page">
      <div className="studio-page-head" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Link href="/studio/books" className="studio-btn studio-btn--ghost"><ArrowLeft size={16} /> К книгам</Link>
        <h1 style={{ margin: 0 }}>Книга</h1>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center' }}>
          {savedAt && <span style={{ fontSize: 12, color: 'var(--st-text-muted)' }}>Сохранено {savedAt}</span>}
          <button className="studio-btn studio-btn--primary" onClick={save} disabled={saving}>
            {saving ? <Loader2 size={16} className="spin" /> : <Save size={16} />} Сохранить
          </button>
        </div>
      </div>

      {error && <div className="studio-login__error" style={{ marginBottom: 12 }}>{error}</div>}

      <div className="c-card" style={{ padding: 20, marginBottom: 20, display: 'flex', gap: 20, flexWrap: 'wrap' }}>
        {/* Обложка */}
        <div style={{ flex: 'none', width: 160 }}>
          <div style={{ width: 160, height: 214, borderRadius: 10, overflow: 'hidden', background: 'var(--st-surface, #eee)', display: 'grid', placeItems: 'center', marginBottom: 8 }}>
            {coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={coverUrl} alt="Обложка" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : <ImagePlus size={26} style={{ color: 'var(--st-text-muted)' }} />}
          </div>
          <label className="studio-btn studio-btn--ghost" style={{ cursor: 'pointer', width: '100%', justifyContent: 'center' }}>
            {uploading ? <Loader2 size={15} className="spin" /> : <ImagePlus size={15} />} {coverUrl ? 'Заменить' : 'Обложка'}
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={uploadCover} />
          </label>
          {coverUrl && (
            <button className="studio-btn studio-btn--ghost" style={{ width: '100%', justifyContent: 'center', marginTop: 6 }} onClick={() => { setCoverId(null); setCoverUrl(null) }}>
              <X size={14} /> Убрать
            </button>
          )}
        </div>

        {/* Метаданные */}
        <div style={{ flex: 1, minWidth: 280, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input className="studio-input" placeholder="Название книги" value={title} onChange={(e) => setTitle(e.target.value)} />
          <div>
            <div style={{ fontSize: 13, color: 'var(--st-text-muted)', marginBottom: 4 }}>Аннотация</div>
            <TiptapEditor initialHtml={book.annotationHtml} onChange={setAnnotationHtml} placeholder="О чём книга…" allowImages={false} />
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ minWidth: 160, flex: 1 }}>
              <div style={{ fontSize: 13, color: 'var(--st-text-muted)', marginBottom: 4 }}>Статус</div>
              <StudioSelect value={status} onChange={setStatus} ariaLabel="Статус"
                options={[{ value: 'ongoing', label: 'В процессе' }, { value: 'finished', label: 'Завершено' }, { value: 'frozen', label: 'Заморожено' }]} />
            </div>
            <div style={{ minWidth: 160, flex: 1 }}>
              <div style={{ fontSize: 13, color: 'var(--st-text-muted)', marginBottom: 4 }}>Категория</div>
              <StudioSelect value={categoryId} onChange={setCategoryId} ariaLabel="Категория"
                options={[{ value: '', label: '— без категории —' }, ...catOptions]} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ minWidth: 160, flex: 1 }}>
              <div style={{ fontSize: 13, color: 'var(--st-text-muted)', marginBottom: 4 }}>Уровень для платных глав</div>
              <StudioSelect value={minTierId} onChange={setMinTierId} ariaLabel="Уровень подписки"
                options={[{ value: '', label: 'Вся книга бесплатна' }, ...tiers.map((t) => ({ value: String(t.id), label: `${t.name} и выше` }))]} />
            </div>
            <div style={{ width: 150 }}>
              <div style={{ fontSize: 13, color: 'var(--st-text-muted)', marginBottom: 4 }}>Бесплатных глав</div>
              <input className="studio-input" type="number" min={0} value={freeChapters} onChange={(e) => setFreeChapters(e.target.value)} />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, paddingBottom: 8 }}>
              <input type="checkbox" checked={isAdult} onChange={(e) => setIsAdult(e.target.checked)} /> 18+
            </label>
          </div>
          {/* Теги */}
          <div>
            <div style={{ fontSize: 13, color: 'var(--st-text-muted)', marginBottom: 4 }}>Теги</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
              {tags.map((t) => (
                <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 999, background: 'color-mix(in srgb, var(--st-primary, #7b4dff) 14%, transparent)', fontSize: 13 }}>
                  {t}
                  <button onClick={() => setTags(tags.filter((x) => x !== t))} style={{ border: 0, background: 'transparent', cursor: 'pointer', display: 'grid', placeItems: 'center' }}><X size={12} /></button>
                </span>
              ))}
            </div>
            <input className="studio-input" placeholder="Добавить тег и Enter" value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }} />
          </div>
        </div>
      </div>

      <ChaptersManager bookId={book.id} initialChapters={chapters} tiers={tiers} />
    </div>
  )
}
