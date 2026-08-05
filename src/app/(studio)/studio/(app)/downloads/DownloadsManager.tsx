'use client'

import React, { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Upload, Pencil, Download, Lock, Unlock, FileDown, Trash2, X } from 'lucide-react'
import { StudioSelect } from '../_ui/StudioSelect'

type Tier = { id: number | string; name: string }
type Cat = { id: number | string; title: string; parentId: number | null }
type Item = {
  id: number | string
  title: string
  description: string
  filename: string | null
  mimeType: string | null
  filesize: number | null
  minTierName: string | null
  minTierId: string
  isPreview: boolean
  addedAt: string | null
  categoryId: string
}

/** Категории в порядке дерева + depth (StudioSelect делает отступ по depth). */
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

function formatBytes(n: number | null): string {
  if (!n || n <= 0) return ''
  const u = ['Б', 'КБ', 'МБ', 'ГБ']
  let i = 0
  let v = n
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${u[i]}`
}

/**
 * Раздел «Файлы» студии: загрузка цифровых товаров (книги/PDF/архивы) в S3 и
 * список файлов. Гейтинг (уровень/бесплатно/категория) задаётся при загрузке и
 * правится в модалке. Скачивание идёт через защищённый роут `/api/download/[id]`.
 */
export function DownloadsManager({
  initialItems,
  tiers,
  categories,
}: {
  initialItems: Item[]
  tiers: Tier[]
  categories: Cat[]
}) {
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [minTierId, setMinTierId] = useState('')
  const [isPreview, setIsPreview] = useState(false)
  const [categoryId, setCategoryId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<Item | null>(null)
  const catOptions = useMemo(() => categoryOptions(categories), [categories])

  async function upload() {
    setError(null)
    if (!file) {
      setError('Выберите файл')
      return
    }
    setBusy(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('title', title.trim() || file.name)
      if (description.trim()) fd.append('description', description.trim())
      if (minTierId) fd.append('minTierId', minTierId)
      if (isPreview) fd.append('isPreview', '1')
      if (categoryId) fd.append('categoryId', categoryId)
      const res = await fetch('/studio/api/downloads/upload', {
        method: 'POST',
        credentials: 'include',
        body: fd,
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.error || 'Не удалось загрузить файл')
        setBusy(false)
        return
      }
      setFile(null)
      setTitle('')
      setDescription('')
      setMinTierId('')
      setIsPreview(false)
      setCategoryId('')
      router.refresh()
    } catch {
      setError('Ошибка соединения')
    } finally {
      setBusy(false)
    }
  }

  async function remove(item: Item) {
    if (!confirm(`Удалить файл «${item.title}»?`)) return
    try {
      const res = await fetch('/studio/api/downloads/delete', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id }),
      })
      if (res.ok) router.refresh()
      else {
        const j = await res.json().catch(() => ({}))
        alert(j.error || 'Не удалось удалить файл')
      }
    } catch {
      alert('Ошибка соединения')
    }
  }

  return (
    <div className="studio-page">
      <div className="studio-page-head">
        <h1>Файлы</h1>
      </div>

      {/* Загрузка */}
      <div className="c-card" style={{ padding: 20, marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontWeight: 700 }}>Загрузить файл</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <label className="studio-btn studio-btn--ghost" style={{ cursor: 'pointer' }}>
            <Upload size={16} /> Выбрать файл
            <input
              type="file"
              style={{ display: 'none' }}
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </label>
          <span
            style={{
              fontSize: 13,
              color: file ? 'var(--st-text)' : 'var(--st-text-muted)',
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {file ? `${file.name}${file.size ? ` · ${formatBytes(file.size)}` : ''}` : 'Файл не выбран'}
          </span>
        </div>
        <input
          className="studio-input"
          placeholder="Название"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <textarea
          className="studio-input"
          placeholder="Описание (необязательно)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          style={{ resize: 'vertical' }}
        />
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 200, flex: 1 }}>
            <StudioSelect
              value={minTierId}
              onChange={setMinTierId}
              options={[
                { value: '', label: 'Все / бесплатно' },
                ...tiers.map((t) => ({ value: String(t.id), label: `${t.name} и выше` })),
              ]}
              ariaLabel="Уровень доступа"
            />
          </div>
          <div style={{ minWidth: 200, flex: 1 }}>
            <StudioSelect
              value={categoryId}
              onChange={setCategoryId}
              options={[{ value: '', label: '— без категории —' }, ...catOptions]}
              ariaLabel="Категория"
            />
          </div>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
          <input type="checkbox" checked={isPreview} onChange={(e) => setIsPreview(e.target.checked)} />
          Бесплатно для всех (перебивает уровень)
        </label>
        {error && <div className="studio-login__error">{error}</div>}
        <div style={{ fontSize: 12, color: 'var(--st-text-muted)' }}>
          Книги, PDF, архивы и другие цифровые товары до 300 МБ. Скачивание — по подписке.
        </div>
        <div>
          <button className="studio-btn studio-btn--primary" onClick={upload} disabled={busy}>
            {busy ? <Loader2 size={16} className="spin" /> : <Upload size={16} />} Загрузить
          </button>
        </div>
      </div>

      {/* Список */}
      {initialItems.length === 0 ? (
        <div className="studio-empty">
          <div className="studio-empty__icon"><FileDown size={28} /></div>
          <div className="studio-empty__title">Файлов пока нет</div>
          <div className="studio-empty__text">Загрузите первый файл выше.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {initialItems.map((a) => (
            <div
              key={a.id}
              className="c-card"
              style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}
            >
              <FileDown size={18} style={{ flex: 'none', color: 'var(--st-text-muted)' }} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: 600 }}>{a.title}</div>
                <div style={{ fontSize: 12, color: 'var(--st-text-muted)', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  {a.isPreview ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Unlock size={12} /> Бесплатно</span>
                  ) : a.minTierName ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Lock size={12} /> {a.minTierName}</span>
                  ) : (
                    <span>Бесплатно</span>
                  )}
                  {a.filesize != null && <span>{formatBytes(a.filesize)}</span>}
                  {a.addedAt && <span>{new Date(a.addedAt).toLocaleDateString('ru-RU')}</span>}
                </div>
              </div>
              <a href={`/api/download/${a.id}`} target="_blank" rel="noopener noreferrer" className="studio-btn studio-btn--ghost">
                <Download size={14} /> Скачать
              </a>
              <button className="studio-btn studio-btn--ghost" onClick={() => setEditing(a)}>
                <Pencil size={14} /> Изменить
              </button>
              <button className="studio-btn studio-btn--ghost" onClick={() => remove(a)} title="Удалить">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <EditModal
          item={editing}
          tiers={tiers}
          catOptions={catOptions}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            router.refresh()
          }}
        />
      )}
    </div>
  )
}

/** Модалка правки файла: название/описание/уровень/категория/бесплатно. */
function EditModal({
  item,
  tiers,
  catOptions,
  onClose,
  onSaved,
}: {
  item: Item
  tiers: Tier[]
  catOptions: { value: string; label: string; depth: number }[]
  onClose: () => void
  onSaved: () => void
}) {
  const [title, setTitle] = useState(item.title)
  const [description, setDescription] = useState(item.description)
  const [minTierId, setMinTierId] = useState(item.minTierId)
  const [categoryId, setCategoryId] = useState(item.categoryId)
  const [isPreview, setIsPreview] = useState(item.isPreview)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setError(null)
    if (!title.trim()) {
      setError('Укажите название')
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/studio/api/downloads/update', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: item.id,
          title: title.trim(),
          description: description.trim(),
          minTierId: minTierId || '',
          categoryId: categoryId || '',
          isPreview,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.error || 'Не удалось сохранить')
        setBusy(false)
        return
      }
      onSaved()
    } catch {
      setError('Ошибка соединения')
      setBusy(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'grid',
        placeItems: 'center', padding: 16, zIndex: 50,
      }}
      onClick={onClose}
    >
      <div
        className="c-card"
        style={{ width: 'min(520px, 100%)', padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>Изменить файл</div>
          <button className="studio-btn studio-btn--ghost" onClick={onClose} aria-label="Закрыть"><X size={16} /></button>
        </div>
        <input className="studio-input" placeholder="Название" value={title} onChange={(e) => setTitle(e.target.value)} />
        <textarea
          className="studio-input" placeholder="Описание" rows={3} style={{ resize: 'vertical' }}
          value={description} onChange={(e) => setDescription(e.target.value)}
        />
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 180, flex: 1 }}>
            <StudioSelect
              value={minTierId}
              onChange={setMinTierId}
              options={[{ value: '', label: 'Все / бесплатно' }, ...tiers.map((t) => ({ value: String(t.id), label: `${t.name} и выше` }))]}
              ariaLabel="Уровень доступа"
            />
          </div>
          <div style={{ minWidth: 180, flex: 1 }}>
            <StudioSelect
              value={categoryId}
              onChange={setCategoryId}
              options={[{ value: '', label: '— без категории —' }, ...catOptions]}
              ariaLabel="Категория"
            />
          </div>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
          <input type="checkbox" checked={isPreview} onChange={(e) => setIsPreview(e.target.checked)} />
          Бесплатно для всех (перебивает уровень)
        </label>
        {error && <div className="studio-login__error">{error}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="studio-btn studio-btn--ghost" onClick={onClose} disabled={busy}>Отмена</button>
          <button className="studio-btn studio-btn--primary" onClick={save} disabled={busy}>
            {busy ? <Loader2 size={16} className="spin" /> : null} Сохранить
          </button>
        </div>
      </div>
    </div>
  )
}
