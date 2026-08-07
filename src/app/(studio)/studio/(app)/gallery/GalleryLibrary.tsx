'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Upload, Loader2, Check, AlertCircle, Folder, FolderInput, Trash2, X, Images,
} from 'lucide-react'
import { StudioSelect } from '../_ui/StudioSelect'
import { GalleryFolderManager } from '../posts/new/GalleryComposer'
import { errorMessage } from '@/lib/errorMessage'

type FolderItem = { id: number | string; title: string; parentId: number | string | null }
type LibImage = { id: number | string; url: string | null; width: number | null; height: number | null; alt: string; folderId: number | string | null }
type UploadTask = { key: string; name: string; status: 'uploading' | 'done' | 'error'; error?: string }

function flattenFolders(folders: FolderItem[]) {
  const byParent = new Map<string, FolderItem[]>()
  for (const f of folders) {
    const key = f.parentId == null ? 'root' : String(f.parentId)
    if (!byParent.has(key)) byParent.set(key, [])
    byParent.get(key)!.push(f)
  }
  const out: { id: number | string; title: string; depth: number }[] = []
  const walk = (key: string, depth: number) => {
    for (const k of byParent.get(key) || []) {
      out.push({ id: k.id, title: k.title, depth })
      walk(String(k.id), depth + 1)
    }
  }
  walk('root', 0)
  return out
}

/**
 * Общая библиотека изображений тенанта (раздел «Галерея» в Медиа). Тот же
 * контент, что композер публикаций подтягивает «из библиотеки», но как
 * самостоятельный менеджер: загрузка, папки, перемещение, удаление.
 * Переиспользует готовые роуты gallery-images/{list,upload,set-folder,delete}
 * и gallery-folders/*, а также GalleryFolderManager из композера.
 */
export function GalleryLibrary({ folders, canCreate = true }: { folders: FolderItem[]; canCreate?: boolean }) {
  const router = useRouter()
  const flat = flattenFolders(folders)

  const [folder, setFolder] = useState<string>('all')
  const [images, setImages] = useState<LibImage[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [tasks, setTasks] = useState<UploadTask[]>([])
  const [managing, setManaging] = useState(false)
  const [moveTarget, setMoveTarget] = useState('')
  const [busy, setBusy] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => { setPage(1); setImages([]) }, [folder])

  useEffect(() => {
    let stop = false
    setLoading(true)
    const qs = new URLSearchParams({ folder, page: String(page), limit: '48' })
    fetch(`/studio/api/gallery-images/list?${qs}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((json) => {
        if (stop) return
        if (json.ok) {
          setImages((prev) => (page === 1 ? json.images : [...prev, ...json.images]))
          setTotalPages(json.totalPages || 1)
          setTotal(json.total || 0)
        }
      })
      .catch(() => {})
      .finally(() => !stop && setLoading(false))
    return () => { stop = true }
  }, [folder, page, reloadKey])

  const reload = useCallback(() => { setSelected(new Set()); setPage(1); setImages([]); setReloadKey((k) => k + 1) }, [])

  async function uploadFiles(files: File[]) {
    if (!files.length) return
    for (const file of files) {
      const key = `${Date.now()}-${file.name}`
      setTasks((prev) => [...prev, { key, name: file.name, status: 'uploading' }])
      try {
        const fd = new FormData()
        fd.append('file', file)
        const res = await fetch('/studio/api/gallery-images/upload', { method: 'POST', body: fd, credentials: 'include' })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Ошибка загрузки')
        setTasks((prev) => prev.map((t) => (t.key === key ? { ...t, status: 'done' } : t)))
      } catch (e) {
        setTasks((prev) => prev.map((t) => (t.key === key ? { ...t, status: 'error', error: errorMessage(e) } : t)))
      }
    }
    setTimeout(() => setTasks((prev) => prev.filter((t) => t.status === 'error')), 2500)
    reload()
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    if (files.length) uploadFiles(files)
    if (fileInput.current) fileInput.current.value = ''
  }

  function toggle(id: number | string) {
    const k = String(id)
    setSelected((prev) => {
      const n = new Set(prev)
      if (n.has(k)) n.delete(k); else n.add(k)
      return n
    })
  }

  async function moveSelected() {
    if (selected.size === 0 || moveTarget === '') return
    setBusy(true)
    const folderId = moveTarget === 'none' ? null : moveTarget || null
    try {
      for (const imageId of selected) {
        await fetch('/studio/api/gallery-images/set-folder', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
          body: JSON.stringify({ imageId, folderId }),
        })
      }
      setMoveTarget('')
      reload()
    } finally { setBusy(false) }
  }

  async function deleteSelected() {
    if (selected.size === 0) return
    if (!window.confirm(`Удалить выбранные изображения (${selected.size})? Действие необратимо.`)) return
    setBusy(true)
    let blocked = 0
    try {
      for (const id of selected) {
        const res = await fetch('/studio/api/gallery-images/delete', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
          body: JSON.stringify({ id }),
        })
        if (!res.ok) blocked++
      }
      if (blocked > 0) window.alert(`${blocked} изображение(й) не удалено — используются в публикациях. Сначала открепите их там.`)
      reload()
    } finally { setBusy(false) }
  }

  return (
    <div className="studio-page">
      <div className="studio-page-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <h1>Галерея</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ minWidth: 200 }}>
            <StudioSelect
              value={folder}
              onChange={setFolder}
              options={[
                { value: 'all', label: 'Все папки' },
                { value: 'none', label: 'Без папки' },
                ...flat.map((f) => ({ value: String(f.id), label: f.title, depth: f.depth })),
              ]}
              ariaLabel="Папка"
            />
          </div>
          <button className={`studio-btn studio-btn--ghost${managing ? ' is-active' : ''}`} onClick={() => setManaging((v) => !v)}>
            <Folder size={15} /> Папки
          </button>
          {canCreate && (<>
          <button className="studio-btn studio-btn--primary" onClick={() => fileInput.current?.click()}>
            <Upload size={15} /> Загрузить
          </button>
          <input ref={fileInput} type="file" accept="image/*" multiple onChange={onPick} style={{ display: 'none' }} />
          </>)}
        </div>
      </div>

      {managing && (
        <div className="studio-card" style={{ padding: 16, marginBottom: 16 }}>
          <GalleryFolderManager folders={flat} onChanged={() => { router.refresh(); setReloadKey((k) => k + 1) }} />
        </div>
      )}

      {tasks.length > 0 && (
        <ul className="gcomp__queue" style={{ marginBottom: 12 }}>
          {tasks.map((t) => (
            <li key={t.key} className={`gcomp__task gcomp__task--${t.status}`}>
              {t.status === 'uploading' && <Loader2 size={13} className="spin" />}
              {t.status === 'done' && <Check size={13} />}
              {t.status === 'error' && <AlertCircle size={13} />}
              <span className="gcomp__task-name">{t.name}</span>
              {t.status === 'error' && <span className="gcomp__task-err">{t.error}</span>}
            </li>
          ))}
        </ul>
      )}

      {/* Панель действий с выбранными */}
      {selected.size > 0 && (
        <div className="studio-card" style={{ padding: 12, marginBottom: 12, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, color: 'var(--st-text-muted)' }}>Выбрано: {selected.size}</span>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <FolderInput size={15} style={{ color: 'var(--st-text-muted)' }} />
            <div style={{ minWidth: 180 }}>
              <StudioSelect
                value={moveTarget}
                onChange={setMoveTarget}
                options={[
                  { value: '', label: 'Переместить в…' },
                  { value: 'none', label: 'Без папки' },
                  ...flat.map((f) => ({ value: String(f.id), label: f.title, depth: f.depth })),
                ]}
                ariaLabel="Переместить в папку"
              />
            </div>
            <button className="studio-btn studio-btn--ghost" onClick={moveSelected} disabled={busy || moveTarget === ''}>
              {busy ? <Loader2 size={15} className="spin" /> : null} Переместить
            </button>
          </div>
          <button className="studio-btn studio-btn--ghost" onClick={deleteSelected} disabled={busy} style={{ color: 'var(--st-danger, #d33)' }}>
            <Trash2 size={15} /> Удалить
          </button>
          <button className="studio-btn studio-btn--ghost" onClick={() => setSelected(new Set())}>
            <X size={15} /> Снять выбор
          </button>
        </div>
      )}

      {images.length === 0 && !loading ? (
        <div className="studio-empty">
          <div className="studio-empty__icon"><Images size={28} /></div>
          <div className="studio-empty__title">{folder === 'all' ? 'В библиотеке пока нет изображений' : 'В этой папке нет изображений'}</div>
          <div className="studio-empty__text">Загрузите изображения кнопкой «Загрузить».</div>
        </div>
      ) : (
        <>
          <div style={{ fontSize: 12, color: 'var(--st-text-muted)', marginBottom: 8 }}>Всего: {total}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8 }}>
            {images.map((im) => {
              const k = String(im.id)
              const isSel = selected.has(k)
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => toggle(im.id)}
                  title={im.alt || ''}
                  style={{
                    position: 'relative', aspectRatio: '1 / 1', borderRadius: 10, overflow: 'hidden',
                    border: isSel ? '2px solid var(--st-primary, #7b4dff)' : '1px solid var(--st-border, #e5e5e5)',
                    padding: 0, cursor: 'pointer', background: 'var(--st-surface, #f4f4f4)',
                  }}
                >
                  {im.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={im.url} alt={im.alt || ''} draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span style={{ display: 'grid', placeItems: 'center', height: '100%' }}><Images size={18} /></span>
                  )}
                  {isSel && (
                    <span style={{ position: 'absolute', top: 4, right: 4, background: 'var(--st-primary, #7b4dff)', color: '#fff', borderRadius: '50%', width: 20, height: 20, display: 'grid', placeItems: 'center' }}>
                      <Check size={13} />
                    </span>
                  )}
                </button>
              )
            })}
          </div>
          {loading && <div style={{ padding: 16, display: 'flex', gap: 8, alignItems: 'center', color: 'var(--st-text-muted)' }}><Loader2 size={18} className="spin" /> Загрузка…</div>}
          {!loading && page < totalPages && (
            <div style={{ marginTop: 12 }}>
              <button className="studio-btn studio-btn--ghost" onClick={() => setPage((p) => p + 1)}>Показать ещё</button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
