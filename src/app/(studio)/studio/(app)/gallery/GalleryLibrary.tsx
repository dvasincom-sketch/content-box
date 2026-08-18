'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Upload, Loader2, Check, AlertCircle, Folder, FolderInput, Trash2, X, Images,
  FolderOpen, Layers, FolderClosed, Search, ImageOff, Sparkles,
} from 'lucide-react'
import { createPortal } from 'react-dom'
import { StudioSelect } from '../_ui/StudioSelect'
import { GalleryFolderManager } from '../posts/new/GalleryComposer'
import { errorMessage } from '@/lib/errorMessage'
import { formatBytes } from '@/lib/mediaStats'

type FolderItem = { id: number | string; title: string; parentId: number | string | null }
type LibImage = { id: number | string; url: string | null; width: number | null; height: number | null; alt: string; filesize: number | null; folderId: number | string | null; usedCount: number | null }
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
 * Файловый менеджер галереи (раздел «Галерея» в Медиа). Двухпанельный:
 * слева — умные виды («Все», «Без папки») и дерево папок (drop-цели для
 * перемещения), справа — сетка изображений с drag-and-drop.
 *  - Загрузка кладёт файл в ОТКРЫТУЮ сейчас папку (не в общий безпапочный список).
 *  - Перетаскивание картинок на папку в дереве = переместить.
 *  - Перетаскивание файлов с рабочего стола на сетку = загрузка в текущую папку.
 * Переиспользует роуты gallery-images/{list,upload,set-folder,delete} и
 * GalleryFolderManager из композера.
 */
export function GalleryLibrary({ folders, canCreate = true, stats = null }: { folders: FolderItem[]; canCreate?: boolean; stats?: { files: number; bytes: number } | null }) {
  const router = useRouter()
  const flat = flattenFolders(folders)

  const [folder, setFolder] = useState<string>('all') // 'all' | 'none' | '<id>'
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
  const [altOpen, setAltOpen] = useState(false)
  const [q, setQ] = useState('')
  const [qd, setQd] = useState('')
  const [dropFolder, setDropFolder] = useState<string | null>(null) // подсветка папки-цели
  const [fileOver, setFileOver] = useState(false)                   // подсветка сетки (файлы с ОС)
  const fileInput = useRef<HTMLInputElement>(null)
  const dragIdsRef = useRef<string[]>([])

  // id папки для загрузки: числовая папка → в неё; 'all'/'none' → без папки
  const currentFolderId = /^\d+$/.test(folder) ? folder : null

  useEffect(() => { const t = setTimeout(() => setQd(q), 300); return () => clearTimeout(t) }, [q])
  useEffect(() => { setPage(1); setImages([]); setSelected(new Set()) }, [folder, qd])

  useEffect(() => {
    let stop = false
    setLoading(true)
    const qs = new URLSearchParams({ folder, page: String(page), limit: '48', withUsage: '1' })
    if (qd) qs.set('q', qd)
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
  }, [folder, page, reloadKey, qd])

  const reload = useCallback(() => { setSelected(new Set()); setPage(1); setImages([]); setReloadKey((k) => k + 1) }, [])

  const uploadFiles = useCallback(async (files: File[], folderId: string | null) => {
    if (!files.length) return
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const key = `${file.name}-${file.size}-${i}-${reloadKey}`
      setTasks((prev) => [...prev, { key, name: file.name, status: 'uploading' }])
      try {
        const fd = new FormData()
        fd.append('file', file)
        if (folderId != null) fd.append('folderId', folderId)
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
  }, [reload, reloadKey])

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    if (files.length) uploadFiles(files, currentFolderId)
    if (fileInput.current) fileInput.current.value = ''
  }

  function toggle(id: number | string) {
    const k = String(id)
    setSelected((prev) => { const n = new Set(prev); if (n.has(k)) n.delete(k); else n.add(k); return n })
  }

  const moveImages = useCallback(async (ids: string[], folderId: string | null) => {
    if (!ids.length) return
    setBusy(true)
    try {
      for (const imageId of ids) {
        await fetch('/studio/api/gallery-images/set-folder', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
          body: JSON.stringify({ imageId, folderId }),
        })
      }
      reload()
    } finally { setBusy(false) }
  }, [reload])

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

  // --- drag картинок → папка ---
  function onImgDragStart(id: number | string) {
    const k = String(id)
    dragIdsRef.current = selected.has(k) ? Array.from(selected) : [k]
  }
  function onFolderDrop(folderId: string | null) {
    const ids = dragIdsRef.current
    dragIdsRef.current = []
    setDropFolder(null)
    if (ids.length) moveImages(ids, folderId)
  }

  // --- drag файлов с ОС → загрузка в текущую папку ---
  function onGridDragOver(e: React.DragEvent) {
    if (Array.from(e.dataTransfer.types).includes('Files')) { e.preventDefault(); setFileOver(true) }
  }
  function onGridDrop(e: React.DragEvent) {
    if (e.dataTransfer.files && e.dataTransfer.files.length) {
      e.preventDefault(); setFileOver(false)
      uploadFiles(Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/')), currentFolderId)
    }
  }

  const scopeTitle = folder === 'all' ? 'Все изображения' : folder === 'none' ? 'Без папки' : folder === 'orphan' ? 'Не используются' : (flat.find((f) => String(f.id) === folder)?.title || 'Папка')

  const FolderRow = ({ id, label, depth = 0, icon }: { id: string; label: string; depth?: number; icon?: React.ReactNode }) => {
    const active = folder === id
    const isDrop = dropFolder === id
    const droppable = id === 'none' || /^\d+$/.test(id) // 'all' не папка-цель
    const targetFolderId = id === 'none' ? null : (/^\d+$/.test(id) ? id : null)
    return (
      <button
        type="button"
        className={`gml__frow${active ? ' is-active' : ''}${isDrop ? ' is-drop' : ''}`}
        style={{ paddingLeft: 10 + depth * 14 }}
        onClick={() => setFolder(id)}
        onDragOver={droppable ? (e) => { if (dragIdsRef.current.length) { e.preventDefault(); setDropFolder(id) } } : undefined}
        onDragLeave={droppable ? () => setDropFolder((d) => (d === id ? null : d)) : undefined}
        onDrop={droppable ? () => onFolderDrop(targetFolderId) : undefined}
      >
        <span className="gml__frow-ic">{icon}</span>
        <span className="gml__frow-nm">{label}</span>
      </button>
    )
  }

  return (
    <div className="studio-page">
      <style dangerouslySetInnerHTML={{ __html: GML_CSS }} />
      <div className="studio-page-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1>Галерея</h1>
          {stats && <div className="gml__stat">{stats.files} файл. · {formatBytes(stats.bytes)} на диске</div>}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="gml__search">
            <Search size={15} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск по подписи / имени файла" />
            {q && <button type="button" className="gml__search-x" onClick={() => setQ('')} aria-label="Очистить"><X size={13} /></button>}
          </div>
          {canCreate && (<>
            <button className="studio-btn studio-btn--primary" onClick={() => fileInput.current?.click()}>
              <Upload size={15} /> Загрузить{currentFolderId ? ` в «${scopeTitle}»` : ''}
            </button>
            <input ref={fileInput} type="file" accept="image/*" multiple onChange={onPick} style={{ display: 'none' }} />
          </>)}
        </div>
      </div>

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

      <div className="gml">
        <aside className="gml__side">
          <div className="gml__group">
            <FolderRow id="all" label="Все изображения" icon={<Layers size={15} />} />
            <FolderRow id="none" label="Без папки" icon={<FolderOpen size={15} />} />
            <FolderRow id="orphan" label="Не используются" icon={<ImageOff size={15} />} />
          </div>
          <div className="gml__side-h">
            <span>Папки</span>
            <button className={`gml__side-mng${managing ? ' is-active' : ''}`} onClick={() => setManaging((v) => !v)} title="Управление папками"><Folder size={13} /></button>
          </div>
          <div className="gml__tree">
            {flat.length === 0 && <div className="gml__tree-empty">Папок нет</div>}
            {flat.map((f) => (
              <FolderRow key={f.id} id={String(f.id)} label={f.title} depth={f.depth} icon={<FolderClosed size={15} />} />
            ))}
          </div>
          {selected.size > 0 && <div className="gml__hint">Перетащите выбранные на папку, чтобы переместить</div>}
        </aside>

        <section className="gml__main">
          {managing && (
            <div className="studio-card" style={{ padding: 16, marginBottom: 16 }}>
              <GalleryFolderManager folders={flat} onChanged={() => { router.refresh(); setReloadKey((k) => k + 1) }} />
            </div>
          )}

          {selected.size > 0 && (
            <div className="gml__selbar">
              <span className="gml__selbar-c">Выбрано: {selected.size}</span>
              <div className="gml__move">
                <FolderInput size={15} style={{ color: 'var(--st-text-muted)' }} />
                <div style={{ minWidth: 170 }}>
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
                <button className="studio-btn studio-btn--ghost" disabled={busy || moveTarget === ''} onClick={() => { moveImages(Array.from(selected), moveTarget === 'none' ? null : moveTarget); setMoveTarget('') }}>
                  {busy ? <Loader2 size={15} className="spin" /> : null} Переместить
                </button>
              </div>
              <button className="studio-btn studio-btn--ghost" onClick={() => setAltOpen(true)} disabled={busy} title="Сгенерировать alt-подписи по контексту"><Sparkles size={15} /> Alt (Ася)</button>
              <button className="studio-btn studio-btn--ghost" onClick={deleteSelected} disabled={busy} style={{ color: 'var(--st-danger, #d33)' }}><Trash2 size={15} /> Удалить</button>
              <button className="studio-btn studio-btn--ghost" onClick={() => setSelected(new Set())}><X size={15} /> Снять выбор</button>
            </div>
          )}

          <div className="gml__crumb">
            {scopeTitle} <span className="gml__crumb-c">· {total}</span>
            {folder === 'orphan' && images.length > 0 && (
              <button type="button" className="gml__selall" onClick={() => setSelected(new Set(images.map((im) => String(im.id))))}>Выбрать все загруженные</button>
            )}
          </div>
          {folder === 'orphan' && images.length > 0 && (
            <div className="gml__ohint">Эти изображения не встречаются ни в одной публикации. Их можно безопасно удалить, чтобы освободить место.</div>
          )}

          <div
            className={`gml__drop${fileOver ? ' is-fileover' : ''}`}
            onDragOver={onGridDragOver}
            onDragLeave={() => setFileOver(false)}
            onDrop={onGridDrop}
          >
            {images.length === 0 && !loading ? (
              <div className="studio-empty">
                <div className="studio-empty__icon"><Images size={28} /></div>
                <div className="studio-empty__title">{folder === 'all' ? 'В библиотеке пока нет изображений' : folder === 'none' ? 'Нет изображений без папки' : folder === 'orphan' ? 'Неиспользуемых изображений нет — всё в деле' : 'В этой папке нет изображений'}</div>
                <div className="studio-empty__text">Перетащите файлы сюда или нажмите «Загрузить».</div>
              </div>
            ) : (
              <div className="gml__grid">
                {images.map((im) => {
                  const k = String(im.id)
                  const isSel = selected.has(k)
                  return (
                    <div
                      key={k}
                      className={`gml__cell${isSel ? ' is-sel' : ''}`}
                      draggable
                      onDragStart={() => onImgDragStart(im.id)}
                      onClick={() => toggle(im.id)}
                      title={im.alt || ''}
                    >
                      {im.url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={im.url} alt={im.alt || ''} draggable={false} />
                      ) : (
                        <span className="gml__cell-empty"><Images size={18} /></span>
                      )}
                      {im.usedCount != null && im.usedCount > 0 && <span className="gml__use">в {im.usedCount}</span>}
                      {im.usedCount === 0 && <span className="gml__use gml__use--no">не исп.</span>}
                      {im.filesize ? <span className="gml__size">{formatBytes(im.filesize)}</span> : null}
                      {isSel && <span className="gml__check"><Check size={13} /></span>}
                    </div>
                  )
                })}
              </div>
            )}
            {fileOver && <div className="gml__dropmsg">Отпустите, чтобы загрузить{currentFolderId ? ` в «${scopeTitle}»` : ''}</div>}
          </div>

          {loading && <div className="gml__loading"><Loader2 size={18} className="spin" /> Загрузка…</div>}
          {!loading && page < totalPages && (
            <div style={{ marginTop: 12 }}>
              <button className="studio-btn studio-btn--ghost" onClick={() => setPage((p) => p + 1)}>Показать ещё</button>
            </div>
          )}
        </section>
        {altOpen && (
          <AltSeoModal
            images={images.filter((im) => selected.has(String(im.id)))}
            onClose={() => setAltOpen(false)}
            onSaved={() => { setAltOpen(false); setSelected(new Set()); setReloadKey((k) => k + 1) }}
          />
        )}
      </div>
    </div>
  )
}

/** Модалка: Ася предлагает alt-подписи для выбранных фото; автор правит и сохраняет. */
function AltSeoModal({ images, onClose, onSaved }: { images: LibImage[]; onClose: () => void; onSaved: () => void }) {
  const [rows, setRows] = useState(() => images.map((im) => ({ id: String(im.id), url: im.url, alt: im.alt || '' })))
  const [busy, setBusy] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cost, setCost] = useState<number | null>(null)

  useEffect(() => {
    let alive = true
    fetch('/studio/api/gallery-images/seo', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ ids: images.map((im) => String(im.id)) }),
    })
      .then((r) => r.json().catch(() => null))
      .then((j) => {
        if (!alive) return
        if (!j || j.ok !== true) { setError((j && j.error) || 'Не удалось сгенерировать подписи.'); setBusy(false); return }
        const map = new Map<string, string>(((j.items as { id: string; alt: string }[]) || []).map((it) => [String(it.id), String(it.alt || '')]))
        setRows((rs) => rs.map((r) => { const a = map.get(r.id); return a ? { ...r, alt: a } : r }))
        if (typeof j.costRub === 'number') setCost(j.costRub)
        setBusy(false)
      })
      .catch(() => { if (alive) { setError('Соединение прервалось — попробуйте ещё раз.'); setBusy(false) } })
    return () => { alive = false }
  }, [images])

  const save = () => {
    setSaving(true); setError(null)
    fetch('/studio/api/gallery-images/set-alt', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ items: rows.map((r) => ({ id: r.id, alt: r.alt })) }),
    })
      .then((r) => r.json().catch(() => null))
      .then((j) => { if (!j || j.ok !== true) { setError((j && j.error) || 'Не удалось сохранить.'); setSaving(false); return } onSaved() })
      .catch(() => { setError('Не удалось сохранить.'); setSaving(false) })
  }

  if (typeof document === 'undefined') return null
  return createPortal(
    <div className="gseo__overlay" onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) onClose() }}>
      <style dangerouslySetInnerHTML={{ __html: GML_CSS }} />
      <div className="gseo" role="dialog" aria-modal="true">
        <div className="gseo__head">
          <div className="gseo__title"><Sparkles size={17} /> Alt-подписи от Аси</div>
          <button className="gseo__x" onClick={onClose} disabled={saving} title="Закрыть"><X size={17} /></button>
        </div>
        <div className="gseo__sub">Уникальные подписи по контексту публикации — для органического трафика по картинкам. Проверьте и при необходимости поправьте перед сохранением.{cost != null ? ` · разбор ≈ ${cost.toFixed(2)} ₽` : ''}</div>
        {error && <div className="gseo__err">{error}</div>}
        <div className="gseo__body">
          {busy ? (
            <div className="gseo__load"><Loader2 size={22} className="spin" /> Ася придумывает подписи…</div>
          ) : rows.map((r, i) => (
            <div className="gseo__row" key={r.id}>
              {r.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="gseo__thumb" src={r.url} alt="" />
              ) : <span className="gseo__thumb gseo__thumb--empty"><Images size={16} /></span>}
              <input className="studio-input gseo__alt" value={r.alt} placeholder="Alt-подпись" onChange={(e) => setRows((rs) => rs.map((x, j) => j === i ? { ...x, alt: e.target.value } : x))} />
            </div>
          ))}
        </div>
        <div className="gseo__foot">
          <button className="studio-btn studio-btn--ghost" onClick={onClose} disabled={saving}>Отмена</button>
          <button className="studio-btn studio-btn--primary" onClick={save} disabled={busy || saving}>{saving ? <><Loader2 size={15} className="spin" /> Сохраняю…</> : <><Check size={15} /> Сохранить ({rows.length})</>}</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

const GML_CSS = `
.gml{display:grid;grid-template-columns:236px minmax(0,1fr);gap:18px;align-items:start}
.gml__side{position:sticky;top:12px;display:flex;flex-direction:column;gap:6px}
.gml__group{display:flex;flex-direction:column;gap:2px}
.gml__frow{display:flex;align-items:center;gap:9px;width:100%;text-align:left;border:1px solid transparent;background:transparent;border-radius:9px;padding:7px 10px;cursor:pointer;color:var(--st-text);font-size:13.5px}
.gml__frow:hover{background:color-mix(in srgb,var(--st-text) 6%,transparent)}
.gml__frow.is-active{background:color-mix(in srgb,var(--st-accent) 14%,transparent);border-color:color-mix(in srgb,var(--st-accent) 30%,transparent);font-weight:600}
.gml__frow.is-drop{background:color-mix(in srgb,var(--st-accent) 22%,transparent);border-color:var(--st-accent);border-style:dashed}
.gml__frow-ic{display:inline-flex;color:var(--st-text-muted)}
.gml__frow.is-active .gml__frow-ic{color:var(--st-accent)}
.gml__frow-nm{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.gml__side-h{display:flex;align-items:center;justify-content:space-between;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--st-text-muted);font-weight:700;margin:10px 6px 2px}
.gml__side-mng{border:1px solid var(--st-border);background:transparent;border-radius:7px;padding:3px 6px;cursor:pointer;color:var(--st-text-muted);display:inline-flex}
.gml__side-mng:hover,.gml__side-mng.is-active{border-color:var(--st-accent);color:var(--st-accent)}
.gml__tree{display:flex;flex-direction:column;gap:2px}
.gml__tree-empty{font-size:12.5px;color:var(--st-text-faint);padding:6px 10px}
.gml__hint{font-size:11.5px;color:var(--st-text-muted);background:color-mix(in srgb,var(--st-accent) 8%,transparent);border-radius:8px;padding:8px 10px;margin-top:6px;line-height:1.4}
.gml__main{min-width:0}
.gml__selbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;background:var(--st-surface);border:1px solid var(--st-border);border-radius:10px;padding:8px 12px;margin-bottom:12px}
.gml__selbar-c{font-size:13px;color:var(--st-text-muted)}
.gml__move{display:flex;gap:6px;align-items:center}
.gml__crumb{font-size:13px;font-weight:600;color:var(--st-text);margin:0 2px 10px}
.gml__crumb-c{color:var(--st-text-muted);font-weight:500}
.gml__drop{position:relative;border-radius:12px;min-height:160px}
.gml__drop.is-fileover{outline:2px dashed var(--st-accent);outline-offset:4px;background:color-mix(in srgb,var(--st-accent) 6%,transparent)}
.gml__dropmsg{position:absolute;inset:0;display:grid;place-items:center;font-size:14px;font-weight:600;color:var(--st-accent);pointer-events:none}
.gml__grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px}
.gml__cell{position:relative;aspect-ratio:1/1;border-radius:10px;overflow:hidden;border:1px solid var(--st-border);background:var(--st-surface-2,#f4f4f4);cursor:pointer;padding:0}
.gml__cell img{width:100%;height:100%;object-fit:cover;object-position:top center;display:block;pointer-events:none}
.gml__cell.is-sel{border:2px solid var(--st-accent)}
.gml__cell-empty{display:grid;place-items:center;height:100%;color:var(--st-text-muted)}
.gml__check{position:absolute;top:5px;right:5px;background:var(--st-accent);color:#fff;border-radius:50%;width:20px;height:20px;display:grid;place-items:center}
.gml__loading{padding:16px;display:flex;gap:8px;align-items:center;color:var(--st-text-muted)}
.gml__stat{font-size:12.5px;color:var(--st-text-muted);margin-top:3px}
.gml__search{display:flex;align-items:center;gap:6px;border:1px solid var(--st-border);border-radius:9px;padding:5px 10px;background:var(--st-surface);color:var(--st-text-muted);min-width:230px}
.gml__search input{border:0;outline:0;background:transparent;color:var(--st-text);font:inherit;width:100%}
.gml__search-x{border:0;background:transparent;color:var(--st-text-muted);cursor:pointer;display:inline-flex;padding:0}
.gml__size{position:absolute;left:5px;bottom:5px;background:rgba(0,0,0,.62);color:#fff;font-size:10.5px;font-weight:600;padding:2px 6px;border-radius:6px;pointer-events:none;letter-spacing:.02em}
.gml__use{position:absolute;top:5px;left:5px;background:color-mix(in srgb,var(--st-accent) 85%,#000);color:#fff;font-size:10px;font-weight:700;padding:2px 6px;border-radius:6px;pointer-events:none}
.gml__use--no{background:rgba(110,110,120,.75)}
.gml__selall{margin-left:10px;font-size:12px;font-weight:600;color:var(--st-accent);background:transparent;border:0;cursor:pointer;text-decoration:underline;text-underline-offset:3px}
.gml__ohint{font-size:12px;color:var(--st-text-muted);background:color-mix(in srgb,var(--st-accent) 8%,transparent);border-radius:8px;padding:8px 12px;margin:-4px 0 12px;line-height:1.4}
@media(max-width:760px){.gml{grid-template-columns:1fr}.gml__side{position:static}}
.gseo__overlay{position:fixed;inset:0;z-index:1000;background:rgba(0,0,0,.5);display:grid;place-items:center;padding:20px}
.gseo{width:min(680px,96vw);max-height:90vh;display:flex;flex-direction:column;background:var(--st-surface);border:1px solid var(--st-border);border-radius:14px;box-shadow:0 24px 70px rgba(0,0,0,.4);overflow:hidden}
.gseo__head{display:flex;align-items:center;justify-content:space-between;padding:13px 16px;border-bottom:1px solid var(--st-border)}
.gseo__title{display:flex;align-items:center;gap:8px;font-weight:700;font-size:15px;color:var(--st-text)}
.gseo__x{border:0;background:transparent;color:var(--st-text-muted);cursor:pointer;padding:4px;border-radius:7px}
.gseo__x:hover{background:color-mix(in srgb,var(--st-text) 8%,transparent)}
.gseo__sub{font-size:12.5px;color:var(--st-text-muted);padding:10px 16px 0;line-height:1.45}
.gseo__err{margin:10px 16px 0;font-size:13px;color:#e5484d;background:color-mix(in srgb,#e5484d 10%,transparent);border:1px solid color-mix(in srgb,#e5484d 30%,transparent);border-radius:9px;padding:8px 11px}
.gseo__body{padding:12px 16px;overflow:auto;display:flex;flex-direction:column;gap:8px}
.gseo__load{display:flex;align-items:center;gap:10px;justify-content:center;padding:34px 0;color:var(--st-text-muted);font-size:14px}
.gseo__row{display:flex;align-items:center;gap:10px}
.gseo__thumb{width:46px;height:46px;flex:none;border-radius:8px;object-fit:cover;border:1px solid var(--st-border);background:var(--st-surface-2,#f4f4f4)}
.gseo__thumb--empty{display:grid;place-items:center;color:var(--st-text-muted)}
.gseo__alt{flex:1}
.gseo__foot{display:flex;justify-content:space-between;gap:10px;padding:12px 16px;border-top:1px solid var(--st-border)}
`
