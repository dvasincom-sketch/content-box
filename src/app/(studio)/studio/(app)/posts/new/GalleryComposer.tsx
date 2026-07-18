'use client'

import React, { useState, useRef, useCallback, useEffect } from 'react'
import {
  ImagePlus, X, Loader2, GripVertical, Library, Upload, Check, AlertCircle,
} from 'lucide-react'
import { StudioSelect } from '../../_ui/StudioSelect'

export type GalleryItem = {
  imageId: number | string
  url: string | null
  width: number | null
  height: number | null
  caption: string
}

type LibImage = {
  id: number | string
  url: string | null
  width: number | null
  height: number | null
  alt: string
  folderId: number | string | null
}

type FolderItem = { id: number | string; title: string; parentId: number | string | null }

// Элемент очереди загрузки
type UploadTask = {
  key: string
  name: string
  status: 'queued' | 'uploading' | 'done' | 'error'
  error?: string
}

const MAX_IMAGES = 30
const PARALLEL = 3 // одновременных загрузок

function flattenFolders(folders: FolderItem[]) {
  const byParent = new Map<string, FolderItem[]>()
  for (const f of folders) {
    const key = f.parentId == null ? 'root' : String(f.parentId)
    if (!byParent.has(key)) byParent.set(key, [])
    byParent.get(key)!.push(f)
  }
  const out: { id: number | string; title: string; depth: number }[] = []
  function walk(key: string, depth: number) {
    for (const k of byParent.get(key) || []) {
      out.push({ id: k.id, title: k.title, depth })
      walk(String(k.id), depth + 1)
    }
  }
  walk('root', 0)
  return out
}

export function GalleryComposer({
  value,
  onChange,
  folders,
}: {
  value: GalleryItem[]
  onChange: (items: GalleryItem[]) => void
  folders: FolderItem[]
}) {
  const [tasks, setTasks] = useState<UploadTask[]>([])
  const [libOpen, setLibOpen] = useState(false)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  // ref всегда держит актуальное значение галереи — чтобы параллельные
  // воркеры загрузки не затирали друг друга через устаревшее замыкание value.
  const valueRef = useRef<GalleryItem[]>(value)
  useEffect(() => {
    valueRef.current = value
  }, [value])

  // Загрузка одного файла → возвращает GalleryItem или бросает
  const uploadOne = useCallback(async (file: File): Promise<GalleryItem> => {
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/studio/api/gallery-images/upload', {
      method: 'POST',
      body: fd,
      credentials: 'include',
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error || 'Ошибка загрузки')
    return {
      imageId: json.id,
      url: json.url,
      width: json.width,
      height: json.height,
      caption: '',
    }
  }, [])

  // Очередь с ограниченной параллельностью.
  // Каждый успешно загруженный файл дописываем к valueRef.current (актуальному
  // значению), а не к устаревшему замыканию — так параллельные воркеры не
  // затирают результаты друг друга.
  const runQueue = useCallback(
    async (files: File[]) => {
      const room = MAX_IMAGES - valueRef.current.length
      if (room <= 0) return
      const slice = files.slice(0, room)

      const newTasks: UploadTask[] = slice.map((f, i) => ({
        key: `${Date.now()}-${i}-${f.name}`,
        name: f.name,
        status: 'queued',
      }))
      setTasks((prev) => [...prev, ...newTasks])

      let cursor = 0
      async function worker() {
        while (cursor < slice.length) {
          const idx = cursor++
          const file = slice[idx]
          const taskKey = newTasks[idx].key
          setTasks((prev) =>
            prev.map((t) => (t.key === taskKey ? { ...t, status: 'uploading' } : t)),
          )
          try {
            const item = await uploadOne(file)
            // дописываем к актуальному значению и синхронно обновляем ref,
            // чтобы следующий воркер видел уже с этим элементом
            const next = [...valueRef.current, item]
            valueRef.current = next
            onChange(next)
            setTasks((prev) =>
              prev.map((t) => (t.key === taskKey ? { ...t, status: 'done' } : t)),
            )
          } catch (e: any) {
            setTasks((prev) =>
              prev.map((t) =>
                t.key === taskKey ? { ...t, status: 'error', error: e?.message } : t,
              ),
            )
          }
        }
      }

      await Promise.all(Array.from({ length: PARALLEL }, worker))

      // авто-очистка завершённых задач через 2 сек (ошибки оставляем видимыми)
      setTimeout(() => {
        setTasks((prev) => prev.filter((t) => t.status === 'error'))
      }, 2000)
    },
    [onChange, uploadOne],
  )

  function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    if (files.length) runQueue(files)
    if (fileInput.current) fileInput.current.value = ''
  }

  function removeAt(i: number) {
    onChange(value.filter((_, idx) => idx !== i))
  }

  function setCaption(i: number, caption: string) {
    onChange(value.map((it, idx) => (idx === i ? { ...it, caption } : it)))
  }

  // drag-ن-drop переупорядочивание
  function onDrop(target: number) {
    if (dragIndex === null || dragIndex === target) return
    const next = [...value]
    const [moved] = next.splice(dragIndex, 1)
    next.splice(target, 0, moved)
    onChange(next)
    setDragIndex(null)
  }

  function addFromLibrary(imgs: LibImage[]) {
    const room = MAX_IMAGES - value.length
    const existing = new Set(value.map((v) => String(v.imageId)))
    const toAdd = imgs
      .filter((im) => !existing.has(String(im.id)))
      .slice(0, room)
      .map((im) => ({
        imageId: im.id,
        url: im.url,
        width: im.width,
        height: im.height,
        caption: '',
      }))
    if (toAdd.length) onChange([...value, ...toAdd])
    setLibOpen(false)
  }

  return (
    <div className="gcomp">
      {/* Сетка прикреплённых */}
      {value.length > 0 && (
        <div className="gcomp__grid">
          {value.map((it, i) => (
            <div
              key={`${it.imageId}-${i}`}
              className={`gcomp__item${dragIndex === i ? ' is-dragging' : ''}`}
              draggable
              onDragStart={() => setDragIndex(i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDrop(i)}
              onDragEnd={() => setDragIndex(null)}
            >
              <div className="gcomp__thumb">
                <span className="gcomp__grip" title="Перетащите для порядка">
                  <GripVertical size={14} />
                </span>
                {it.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={it.url} alt={it.caption || ''} draggable={false} />
                ) : (
                  <span className="gcomp__thumb-empty"><ImagePlus size={18} /></span>
                )}
                <button
                  type="button"
                  className="gcomp__remove"
                  onClick={() => removeAt(i)}
                  title="Убрать"
                >
                  <X size={13} />
                </button>
                <span className="gcomp__num">{i + 1}</span>
              </div>
              <input
                className="gcomp__caption"
                placeholder="Подпись…"
                value={it.caption}
                onChange={(e) => setCaption(i, e.target.value)}
              />
            </div>
          ))}
        </div>
      )}

      {/* Очередь загрузки */}
      {tasks.length > 0 && (
        <ul className="gcomp__queue">
          {tasks.map((t) => (
            <li key={t.key} className={`gcomp__task gcomp__task--${t.status}`}>
              {t.status === 'uploading' && <Loader2 size={13} className="spin" />}
              {t.status === 'queued' && <Loader2 size={13} className="gcomp__q-wait" />}
              {t.status === 'done' && <Check size={13} />}
              {t.status === 'error' && <AlertCircle size={13} />}
              <span className="gcomp__task-name">{t.name}</span>
              {t.status === 'error' && <span className="gcomp__task-err">{t.error}</span>}
            </li>
          ))}
        </ul>
      )}

      {/* Кнопки добавления */}
      <div className="gcomp__actions">
        <button
          type="button"
          className="gcomp__add"
          onClick={() => fileInput.current?.click()}
          disabled={value.length >= MAX_IMAGES}
        >
          <Upload size={15} />
          Загрузить с устройства
        </button>
        <button
          type="button"
          className="gcomp__add gcomp__add--ghost"
          onClick={() => setLibOpen(true)}
          disabled={value.length >= MAX_IMAGES}
        >
          <Library size={15} />
          Из библиотеки
        </button>
        <span className="gcomp__count">
          {value.length} / {MAX_IMAGES}
        </span>
      </div>
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        multiple
        onChange={onPickFiles}
        style={{ display: 'none' }}
      />

      {libOpen && (
        <LibraryModal
          folders={folders}
          alreadyIn={new Set(value.map((v) => String(v.imageId)))}
          remaining={MAX_IMAGES - value.length}
          onClose={() => setLibOpen(false)}
          onAdd={addFromLibrary}
        />
      )}
    </div>
  )
}

/* ============================================================================
   МОДАЛКА «ИЗ БИБЛИОТЕКИ»
   ============================================================================ */
function LibraryModal({
  folders,
  alreadyIn,
  remaining,
  onClose,
  onAdd,
}: {
  folders: FolderItem[]
  alreadyIn: Set<string>
  remaining: number
  onClose: () => void
  onAdd: (imgs: LibImage[]) => void
}) {
  const flat = flattenFolders(folders)
  const [folder, setFolder] = useState<string>('all')
  const [images, setImages] = useState<LibImage[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  useEffect(() => {
    let stop = false
    setLoading(true)
    const qs = new URLSearchParams({ folder, page: String(page), limit: '40' })
    fetch(`/studio/api/gallery-images/list?${qs}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((json) => {
        if (stop) return
        if (json.ok) {
          setImages((prev) => (page === 1 ? json.images : [...prev, ...json.images]))
          setTotalPages(json.totalPages || 1)
        }
      })
      .catch(() => {})
      .finally(() => !stop && setLoading(false))
    return () => {
      stop = true
    }
  }, [folder, page])

  // при смене папки — сброс на 1 страницу
  useEffect(() => {
    setPage(1)
    setImages([])
  }, [folder])

  function toggle(id: number | string) {
    const key = String(id)
    if (alreadyIn.has(key)) return
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else if (next.size < remaining) next.add(key)
      return next
    })
  }

  function confirm() {
    const chosen = images.filter((im) => selected.has(String(im.id)))
    onAdd(chosen)
  }

  return (
    <div className="glib__overlay" onClick={onClose}>
      <div className="glib" onClick={(e) => e.stopPropagation()}>
        <div className="glib__head">
          <span className="glib__title">Библиотека изображений</span>
          <div className="glib__folder">
            <StudioSelect
              className="glib__folder-select"
              value={folder}
              onChange={setFolder}
              options={[
                { value: 'all', label: 'Все папки' },
                { value: 'none', label: 'Без папки' },
                ...flat.map((f) => ({
                  value: String(f.id),
                  label: f.title,
                  depth: f.depth,
                })),
              ]}
              ariaLabel="Папка"
            />
          </div>
          <button className="catmgr__icon-btn" onClick={onClose} title="Закрыть">
            <X size={18} />
          </button>
        </div>

        <div className="glib__body">
          {images.length === 0 && !loading ? (
            <div className="glib__empty">
              {folder === 'all'
                ? 'В библиотеке пока нет изображений. Загрузите первые с устройства.'
                : 'В этой папке нет изображений.'}
            </div>
          ) : (
            <div className="glib__grid">
              {images.map((im) => {
                const key = String(im.id)
                const isIn = alreadyIn.has(key)
                const isSel = selected.has(key)
                return (
                  <button
                    key={key}
                    type="button"
                    className={`glib__cell${isSel ? ' is-selected' : ''}${isIn ? ' is-in' : ''}`}
                    onClick={() => toggle(im.id)}
                    disabled={isIn}
                    title={isIn ? 'Уже в галерее' : im.alt || ''}
                  >
                    {im.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={im.url} alt={im.alt || ''} draggable={false} />
                    ) : (
                      <span className="glib__cell-empty"><ImagePlus size={18} /></span>
                    )}
                    {isSel && <span className="glib__check"><Check size={14} /></span>}
                    {isIn && <span className="glib__in">уже в галерее</span>}
                  </button>
                )
              })}
            </div>
          )}
          {loading && (
            <div className="glib__loading"><Loader2 size={20} className="spin" /> Загрузка…</div>
          )}
          {!loading && page < totalPages && (
            <button className="studio-btn studio-btn--ghost glib__more" onClick={() => setPage((p) => p + 1)}>
              Показать ещё
            </button>
          )}
        </div>

        <div className="glib__foot">
          <span className="glib__selected-count">
            Выбрано: {selected.size}
            {remaining < 999 ? ` (можно ещё ${remaining})` : ''}
          </span>
          <div className="glib__foot-actions">
            <button className="studio-btn studio-btn--ghost" onClick={onClose}>Отмена</button>
            <button
              className="studio-btn studio-btn--primary"
              onClick={confirm}
              disabled={selected.size === 0}
            >
              Добавить ({selected.size})
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
