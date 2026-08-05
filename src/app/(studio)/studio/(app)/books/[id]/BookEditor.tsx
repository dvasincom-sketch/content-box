'use client'

import React, { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2, ImagePlus, X, ArrowLeft, Save, BookOpen } from 'lucide-react'
import { StudioSelect } from '../../_ui/StudioSelect'
import { TiptapEditor } from '../../posts/new/TiptapEditor'
import { ChaptersManager, type ChapterItem } from './ChaptersManager'
import { BOOK_GENRES } from '@/lib/bookGenres'
import { CategoryMultiPicker } from '../../settings/CategoryMultiPicker'

type Tier = { id: number | string; name: string }
type Cat = { id: number | string; title: string; parentId: number | null }
type BookData = {
  id: number | string
  title: string
  slug: string
  status: string
  type: string
  ageRating: string
  allowComments: boolean
  allowDownload: boolean
  cycleId: string
  cycleOrder: string
  freeChapters: number
  categoryId: string
  minTierId: string
  coverId: number | null
  coverUrl: string | null
  annotationHtml: string
  tags: string[]
  genres: string[]
  quote1: string
  quote2: string
  quote3: string
  booktrailerVideoId: string
}

const GENRE_ITEMS = BOOK_GENRES.map((g) => ({ id: g, title: g, parentId: null as string | null }))

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

/** Редактор произведения: метаданные (сайдбар) + текст + главы. Раскладка — как
 *  у композера публикаций (composer__grid), в стиле студии (моно-акцент). */
export function BookEditor({
  book, chapters, tiers, categories, cycles, videos,
}: {
  book: BookData
  chapters: ChapterItem[]
  tiers: Tier[]
  categories: Cat[]
  cycles: { id: number | string; title: string }[]
  videos: { id: number | string; title: string }[]
}) {
  const router = useRouter()
  const [title, setTitle] = useState(book.title)
  const [status, setStatus] = useState(book.status)
  const [type, setType] = useState(book.type)
  const [ageRating, setAgeRating] = useState(book.ageRating)
  const [allowComments, setAllowComments] = useState(book.allowComments)
  const [allowDownload, setAllowDownload] = useState(book.allowDownload)
  const [cycleId, setCycleId] = useState(book.cycleId)
  const [cycleOrder, setCycleOrder] = useState(book.cycleOrder)
  const [categoryId, setCategoryId] = useState(book.categoryId)
  const [minTierId, setMinTierId] = useState(book.minTierId)
  const [freeChapters, setFreeChapters] = useState(String(book.freeChapters))
  const [coverId, setCoverId] = useState<number | null>(book.coverId)
  const [coverUrl, setCoverUrl] = useState<string | null>(book.coverUrl)
  const [annotationHtml, setAnnotationHtml] = useState(book.annotationHtml)
  const [tags, setTags] = useState<string[]>(book.tags)
  const [tagInput, setTagInput] = useState('')
  const [genres, setGenres] = useState<string[]>(book.genres)
  const [quote1, setQuote1] = useState(book.quote1)
  const [quote2, setQuote2] = useState(book.quote2)
  const [quote3, setQuote3] = useState(book.quote3)
  const [booktrailerVideoId, setBooktrailerVideoId] = useState(book.booktrailerVideoId)
  const [quoteCount, setQuoteCount] = useState(Math.max(1, [book.quote1, book.quote2, book.quote3].filter((q) => q && q.trim()).length))
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
          id: book.id, title: title.trim(), annotation: annotationHtml, status, type, ageRating,
          allowComments, allowDownload, cycleId: cycleId || '', cycleOrder: cycleOrder || '',
          freeChapters: Number(freeChapters) || 0, categoryId: categoryId || '', minTierId: minTierId || '',
          coverId: coverId ?? null, tags, genres, quote1, quote2, quote3, booktrailerVideoId,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) { setError(json.error || 'Не удалось сохранить'); setSaving(false); return }
      setSavedAt(new Date().toLocaleTimeString('ru-RU'))
      router.refresh()
    } catch { setError('Ошибка соединения') } finally { setSaving(false) }
  }

  return (
    <div className="composer">
      <div className="composer__head">
        <Link href="/studio/books" className="studio-btn studio-btn--ghost"><ArrowLeft size={16} /> К произведениям</Link>
        <div className="composer__actions" style={{ alignItems: 'center' }}>
          {savedAt && <span style={{ fontSize: 'var(--st-text-sm)', color: 'var(--st-text-muted)' }}>Сохранено {savedAt}</span>}
          <button className="studio-btn studio-btn--primary" onClick={save} disabled={saving}>
            {saving ? <Loader2 size={16} className="spin" /> : <Save size={16} />} Сохранить
          </button>
        </div>
      </div>

      {error && <div className="studio-login__error composer__error">{error}</div>}

      <div className="composer__grid">
        {/* Центр: название + аннотация */}
        <div className="composer__main">
          <input className="composer__title" placeholder="Название произведения" value={title} onChange={(e) => setTitle(e.target.value)} />
          <div className="studio-field">
            <div className="studio-field__label">Аннотация</div>
            <TiptapEditor initialHtml={book.annotationHtml} onChange={setAnnotationHtml} placeholder="О чём произведение…" allowImages={false} />
          </div>
          <div className="studio-field" style={{ marginTop: 'var(--st-space-4)' }}>
            <div className="studio-field__label">Буктрейлер (видео из раздела «Видео»)</div>
            <StudioSelect value={booktrailerVideoId} onChange={setBooktrailerVideoId} ariaLabel="Буктрейлер"
              options={[{ value: '', label: '— нет —' }, ...videos.map((v) => ({ value: String(v.id), label: v.title }))]} />
            <div style={{ fontSize: 12, color: 'var(--st-text-muted)', marginTop: 4 }}>Сначала добавьте видео в разделе «Видео», затем выберите его здесь.</div>
          </div>
          <div className="studio-field" style={{ marginTop: 'var(--st-space-4)' }}>
            <div className="studio-field__label">Цитаты (видны читателям)</div>
            {[quote1, quote2, quote3].slice(0, quoteCount).map((q, i) => (
              <textarea key={i} className="studio-input" rows={2} placeholder={`Цитата ${i + 1}`} value={q}
                onChange={(e) => [setQuote1, setQuote2, setQuote3][i](e.target.value)}
                style={{ resize: 'vertical', marginBottom: 'var(--st-space-2)' }} />
            ))}
            {quoteCount < 3 && (
              <button type="button" className="studio-btn studio-btn--ghost" style={{ alignSelf: 'flex-start' }}
                onClick={() => setQuoteCount((c) => Math.min(3, c + 1))}>+ Добавить цитату</button>
            )}
          </div>
        </div>

        {/* Сайдбар: обложка + метаданные */}
        <aside className="composer__side">
          <div className="studio-field">
            <div className="studio-field__label">Обложка</div>
            <div style={{ position: 'relative', width: '100%', aspectRatio: '3 / 4', borderRadius: 'var(--st-radius)', overflow: 'hidden', border: '1px solid var(--st-border)', background: 'var(--st-surface)', display: 'grid', placeItems: 'center' }}>
              {coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={coverUrl} alt="Обложка" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : <BookOpen size={30} style={{ color: 'var(--st-text-faint)' }} />}
              {coverUrl && (
                <button className="composer__cover-remove" onClick={() => { setCoverId(null); setCoverUrl(null) }} title="Убрать"><X size={15} /></button>
              )}
            </div>
            <label className="studio-btn studio-btn--ghost" style={{ cursor: 'pointer', justifyContent: 'center' }}>
              {uploading ? <Loader2 size={15} className="spin" /> : <ImagePlus size={15} />} {coverUrl ? 'Заменить' : 'Загрузить'}
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={uploadCover} />
            </label>
          </div>

          <div className="studio-field">
            <div className="studio-field__label">Тип</div>
            <StudioSelect value={type} onChange={setType} ariaLabel="Тип произведения"
              options={[{ value: 'novel', label: 'Роман' }, { value: 'story', label: 'Рассказ' }, { value: 'mini', label: 'Миниатюра' }, { value: 'cycle', label: 'Цикл' }]} />
          </div>
          <div className="studio-field">
            <div className="studio-field__label">Статус</div>
            <StudioSelect value={status} onChange={setStatus} ariaLabel="Статус"
              options={[{ value: 'ongoing', label: 'В процессе' }, { value: 'finished', label: 'Завершено' }, { value: 'frozen', label: 'Заморожено' }]} />
          </div>
          <div className="studio-field">
            <div className="studio-field__label">Категория</div>
            <StudioSelect value={categoryId} onChange={setCategoryId} ariaLabel="Категория"
              options={[{ value: '', label: '— без категории —' }, ...catOptions]} />
          </div>
          <div className="studio-field">
            <div className="studio-field__label">Жанры</div>
            {genres.length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                {genres.map((g) => (
                  <span key={g} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 'var(--st-radius-sm)', background: 'var(--st-surface-hover)', color: 'var(--st-text)', fontSize: 'var(--st-text-sm)' }}>
                    {g}
                    <button onClick={() => setGenres(genres.filter((x) => x !== g))} style={{ border: 0, background: 'transparent', color: 'var(--st-text-muted)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}><X size={12} /></button>
                  </span>
                ))}
              </div>
            )}
            <CategoryMultiPicker categories={GENRE_ITEMS} value={genres} onChange={setGenres} />
          </div>

          <div style={{ display: 'flex', gap: 'var(--st-space-3)' }}>
            <div className="studio-field" style={{ flex: 1, minWidth: 0 }}>
              <div className="studio-field__label">Цикл</div>
              <StudioSelect value={cycleId} onChange={setCycleId} ariaLabel="Цикл"
                options={[{ value: '', label: '— вне цикла —' }, ...cycles.map((c) => ({ value: String(c.id), label: c.title }))]} />
            </div>
            <div className="studio-field" style={{ width: 72 }}>
              <div className="studio-field__label">№</div>
              <input className="studio-input" type="number" min={0} value={cycleOrder} onChange={(e) => setCycleOrder(e.target.value)} />
            </div>
          </div>

          <div className="studio-field">
            <div className="studio-field__label">Уровень для платных глав</div>
            <StudioSelect value={minTierId} onChange={setMinTierId} ariaLabel="Уровень подписки"
              options={[{ value: '', label: 'Вся книга бесплатна' }, ...tiers.map((t) => ({ value: String(t.id), label: `${t.name} и выше` }))]} />
          </div>
          <div style={{ display: 'flex', gap: 'var(--st-space-3)' }}>
            <div className="studio-field" style={{ flex: 1, minWidth: 0 }}>
              <div className="studio-field__label">Бесплатных глав</div>
              <input className="studio-input" type="number" min={0} value={freeChapters} onChange={(e) => setFreeChapters(e.target.value)} />
            </div>
            <div className="studio-field" style={{ width: 96 }}>
              <div className="studio-field__label">Возраст</div>
              <StudioSelect value={ageRating} onChange={setAgeRating} ariaLabel="Возрастной рейтинг"
                options={[{ value: '12', label: '12+' }, { value: '16', label: '16+' }, { value: '18', label: '18+' }]} />
            </div>
          </div>

          <div className="studio-field">
            <div className="studio-field__label">Теги</div>
            {tags.length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {tags.map((t) => (
                  <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 'var(--st-radius-sm)', background: 'var(--st-surface-hover)', color: 'var(--st-text)', fontSize: 'var(--st-text-sm)' }}>
                    {t}
                    <button onClick={() => setTags(tags.filter((x) => x !== t))} style={{ border: 0, background: 'transparent', color: 'var(--st-text-muted)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}><X size={12} /></button>
                  </span>
                ))}
              </div>
            )}
            <input className="studio-input" placeholder="Добавить тег и Enter" value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }} />
          </div>

          <div className="composer__flags">
            <button type="button" className={`composer__flag${allowComments ? ' is-on' : ''}`} onClick={() => setAllowComments((v) => !v)}>Комментарии</button>
            <button type="button" className={`composer__flag${allowDownload ? ' is-on' : ''}`} onClick={() => setAllowDownload((v) => !v)}>Скачивание</button>
          </div>
        </aside>
      </div>

      {/* Главы — на всю ширину под сеткой */}
      <div style={{ marginTop: 'var(--st-space-6)' }}>
        <ChaptersManager bookId={book.id} initialChapters={chapters} tiers={tiers} />
      </div>
    </div>
  )
}
