'use client'

import React, { useState, useEffect, useRef, useMemo, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import * as tus from 'tus-js-client'
import {
  Plus, Video as VideoIcon, Loader2, Check, Clock, Link as LinkIcon, Lock, Unlock,
  Upload, X, Play, Folder, FolderPlus, Pencil, Trash2, ChevronRight, ChevronDown,
} from 'lucide-react'
import { VideoPreviewModal } from './VideoPreviewModal'
import { StudioSelect } from '../_ui/StudioSelect'

type Tier = { id: number | string; name: string }
type FolderItem = { id: number | string; title: string; parentId: number | string | null }
type Vid = {
  id: number | string
  title: string
  videoRef: string | null
  isPreview: boolean
  minTierName: string | null
  durationSec: number | null
  coverUrl: string | null
  folderId: number | string | null
  addedAt: string | null
}

const FILTER_ALL = '__all__'
const FILTER_NONE = '__none__'

function fmtDur(sec: number | null): string {
  if (!sec) return ''
  const m = Math.floor(sec / 60)
  const s = Math.round(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

function fmtDate(iso: string | null): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  } catch {
    return ''
  }
}

/**
 * Раскладывает дерево папок в плоский список с уровнем вложенности (для
 * отступов в селекторах/меню). Порядок — родитель, затем его дети рекурсивно.
 */
function flattenFolders(
  folders: FolderItem[],
): { id: number | string; title: string; depth: number }[] {
  const byParent = new Map<string, FolderItem[]>()
  for (const f of folders) {
    const key = f.parentId == null ? 'root' : String(f.parentId)
    if (!byParent.has(key)) byParent.set(key, [])
    byParent.get(key)!.push(f)
  }
  const out: { id: number | string; title: string; depth: number }[] = []
  function walk(key: string, depth: number) {
    const kids = byParent.get(key) || []
    for (const k of kids) {
      out.push({ id: k.id, title: k.title, depth })
      walk(String(k.id), depth + 1)
    }
  }
  walk('root', 0)
  return out
}

export function VideosManager({
  initialVideos,
  tiers,
  folders: initialFolders,
}: {
  initialVideos: Vid[]
  tiers: Tier[]
  folders: FolderItem[]
}) {
  const router = useRouter()
  const [videos, setVideos] = useState<Vid[]>(initialVideos)
  const [folders, setFolders] = useState<FolderItem[]>(initialFolders)

  // после router.refresh() приходят свежие данные — синхронизируем
  useEffect(() => setVideos(initialVideos), [initialVideos])
  useEffect(() => setFolders(initialFolders), [initialFolders])

  const [adding, setAdding] = useState(false)
  const [filter, setFilter] = useState<string>(FILTER_ALL) // FILTER_ALL | FILTER_NONE | folderId

  const flatFolders = useMemo(() => flattenFolders(folders), [folders])
  const folderNameById = useMemo(() => {
    const m = new Map<string, string>()
    for (const f of folders) m.set(String(f.id), f.title)
    return m
  }, [folders])

  const visibleVideos = useMemo(() => {
    if (filter === FILTER_ALL) return videos
    if (filter === FILTER_NONE) return videos.filter((v) => v.folderId == null)
    return videos.filter((v) => String(v.folderId) === filter)
  }, [videos, filter])

  // Оптимистично меняем папку видео локально (без полного refresh)
  function applyFolderLocally(videoId: number | string, folderId: number | string | null) {
    setVideos((prev) =>
      prev.map((v) => (String(v.id) === String(videoId) ? { ...v, folderId } : v)),
    )
  }

  return (
    <>
      <div className="studio-page-head">
        <div>
          <h1>Видео</h1>
          <div className="studio-page-head__sub">Всего: {videos.length}</div>
        </div>
        <button className="studio-btn studio-btn--primary" onClick={() => setAdding((v) => !v)}>
          <Plus size={18} />
          Добавить видео
        </button>
      </div>

      {adding && (
        <AddPanel
          tiers={tiers}
          onDone={() => {
            setAdding(false)
            router.refresh()
          }}
          onCancel={() => setAdding(false)}
        />
      )}

      <FolderBar
        folders={folders}
        flatFolders={flatFolders}
        filter={filter}
        onFilter={setFilter}
        counts={{
          all: videos.length,
          none: videos.filter((v) => v.folderId == null).length,
        }}
        onChanged={() => router.refresh()}
      />

      {videos.length === 0 ? (
        <div className="studio-empty">
          <div className="studio-empty__icon"><VideoIcon size={28} /></div>
          <div className="studio-empty__title">Видео пока нет</div>
          <div className="studio-empty__text">Добавьте первое видео по ссылке из вашего хранилища.</div>
        </div>
      ) : visibleVideos.length === 0 ? (
        <div className="studio-empty">
          <div className="studio-empty__icon"><Folder size={28} /></div>
          <div className="studio-empty__title">В этой папке пусто</div>
          <div className="studio-empty__text">Назначьте видео эту папку через столбец «Папка».</div>
        </div>
      ) : (
        <div className="vidtable__wrap">
          <table className="vidtable">
            <thead>
              <tr>
                <th className="vidtable__th-thumb"></th>
                <th>Название</th>
                <th className="vidtable__th-dur">Длительность</th>
                <th className="vidtable__th-tier">Уровень</th>
                <th className="vidtable__th-status">Статус</th>
                <th className="vidtable__th-folder">Папка</th>
                <th className="vidtable__th-date">Добавлено</th>
              </tr>
            </thead>
            <tbody>
              {visibleVideos.map((v) => (
                <VideoRow
                  key={v.id}
                  video={v}
                  flatFolders={flatFolders}
                  folderName={v.folderId != null ? folderNameById.get(String(v.folderId)) || null : null}
                  onFolderChange={applyFolderLocally}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

/* ============================================================================
   ДРОПДАУН ПАПОК (переиспользуемый; меню через портал, position:fixed —
   не режется overflow таблицы и авто-переворачивается вверх у края экрана)
   ============================================================================ */
type DropItem = { value: string; label: string; depth: number; active?: boolean }

function FolderDropdown({
  items,
  triggerClass,
  triggerContent,
  emptyText,
  onSelect,
}: {
  items: DropItem[]
  triggerClass: string
  triggerContent: React.ReactNode
  emptyText?: string
  onSelect: (value: string) => void
}) {
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number; width: number; up: boolean } | null>(null)

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return
    const r = btnRef.current.getBoundingClientRect()
    const menuH = Math.min(280, 44 + items.length * 34)
    const spaceBelow = window.innerHeight - r.bottom
    const up = spaceBelow < menuH && r.top > spaceBelow
    setPos({
      left: r.left,
      top: up ? r.top : r.bottom,
      width: Math.max(r.width, 180),
      up,
    })
  }, [open, items.length])

  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

  return (
    <>
      <button ref={btnRef} className={triggerClass} onClick={() => setOpen((v) => !v)}>
        {triggerContent}
      </button>
      {open &&
        pos &&
        typeof document !== 'undefined' &&
        createPortal(
          <>
            <div className="vidmenu__backdrop" onClick={() => setOpen(false)} />
            <div
              className="vidmenu"
              style={{
                left: pos.left,
                width: pos.width,
                ...(pos.up
                  ? { bottom: window.innerHeight - pos.top + 4 }
                  : { top: pos.top + 4 }),
              }}
            >
              {items.length === 0 ? (
                <div className="vidmenu__empty">{emptyText || 'Пусто'}</div>
              ) : (
                items.map((it) => (
                  <button
                    key={it.value}
                    className={`vidmenu__item${it.active ? ' is-active' : ''}`}
                    style={{ paddingLeft: `${12 + it.depth * 14}px` }}
                    onClick={() => {
                      setOpen(false)
                      onSelect(it.value)
                    }}
                  >
                    {it.label}
                  </button>
                ))
              )}
            </div>
          </>,
          document.body,
        )}
    </>
  )
}

/* ============================================================================
   СТРОКА ТАБЛИЦЫ
   ============================================================================ */
function VideoRow({
  video,
  flatFolders,
  folderName,
  onFolderChange,
}: {
  video: Vid
  flatFolders: { id: number | string; title: string; depth: number }[]
  folderName: string | null
  onFolderChange: (videoId: number | string, folderId: number | string | null) => void
}) {
  const [ready, setReady] = useState<boolean | null>(null)
  const [pct, setPct] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const timer = useRef<any>(null)

  useEffect(() => {
    if (!video.videoRef) return
    let stopped = false
    async function poll() {
      try {
        const res = await fetch(`/studio/api/videos/status?id=${video.id}`, {
          credentials: 'include',
        })
        const json = await res.json()
        if (stopped) return
        if (json.ready) {
          setReady(true)
          setPct(null)
          return
        }
        setReady(false)
        setPct(json.pct || null)
        timer.current = setTimeout(poll, 5000)
      } catch {
        if (!stopped) timer.current = setTimeout(poll, 8000)
      }
    }
    poll()
    return () => {
      stopped = true
      if (timer.current) clearTimeout(timer.current)
    }
  }, [video.id, video.videoRef])

  async function assignFolder(folderId: number | string | null) {
    // оптимистично
    const prev = video.folderId
    onFolderChange(video.id, folderId)
    try {
      const res = await fetch('/studio/api/videos/set-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ videoId: video.id, folderId: folderId ?? null }),
      })
      if (!res.ok) onFolderChange(video.id, prev) // откат
    } catch {
      onFolderChange(video.id, prev)
    }
  }

  return (
    <tr className="vidtable__row">
      {/* Тумба-превью */}
      <td className="vidtable__thumb-cell">
        <button
          className="vidtable__thumb"
          onClick={() => ready && setPlaying(true)}
          disabled={ready !== true}
          title={ready === true ? 'Смотреть' : 'Видео ещё кодируется'}
        >
          {video.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={video.coverUrl} alt="" />
          ) : (
            <span className="vidtable__thumb-empty"><VideoIcon size={16} /></span>
          )}
          {ready === true && (
            <span className="vidtable__thumb-play"><Play size={14} /></span>
          )}
          {video.durationSec ? (
            <span className="vidtable__thumb-dur">{fmtDur(video.durationSec)}</span>
          ) : null}
        </button>
      </td>

      {/* Название */}
      <td className="vidtable__title-cell">
        <span className="vidtable__title" title={video.title}>{video.title}</span>
      </td>

      {/* Длительность */}
      <td className="vidtable__dur-cell">{fmtDur(video.durationSec) || '—'}</td>

      {/* Уровень */}
      <td>
        {video.isPreview ? (
          <span className="vid__badge vid__badge--free"><Unlock size={12} /> Бесплатно</span>
        ) : video.minTierName ? (
          <span className="vid__badge"><Lock size={12} /> {video.minTierName}</span>
        ) : (
          <span className="vid__badge"><Unlock size={12} /> Все</span>
        )}
      </td>

      {/* Статус */}
      <td>
        {ready === true && (
          <span className="vid__status vid__status--ok"><Check size={13} /> Готово</span>
        )}
        {ready === false && (
          <span className="vid__status vid__status--wait">
            <Loader2 size={13} className="spin" /> Кодируется{pct ? ` ${pct}%` : ''}
          </span>
        )}
        {ready === null && video.videoRef && (
          <span className="vid__status"><Clock size={13} /> Проверка…</span>
        )}
        {ready === null && !video.videoRef && (
          <span className="vid__status vid__status--wait"><Clock size={13} /> Нет файла</span>
        )}
      </td>

      {/* Папка */}
      <td className="vidtable__folder-cell">
        <FolderDropdown
          triggerClass={`vidtable__folder-btn${folderName ? '' : ' is-empty'}`}
          triggerContent={
            folderName ? (
              <><Folder size={13} /> <span className="vidtable__folder-name">{folderName}</span></>
            ) : (
              <span className="vidtable__folder-empty">— выбрать —</span>
            )
          }
          emptyText="Папок пока нет"
          items={[
            { value: '', label: 'Без папки', depth: 0, active: video.folderId == null },
            ...flatFolders.map((f) => ({
              value: String(f.id),
              label: f.title,
              depth: f.depth,
              active: String(video.folderId) === String(f.id),
            })),
          ]}
          onSelect={(val) => assignFolder(val === '' ? null : val)}
        />
      </td>

      {/* Дата */}
      <td className="vidtable__date-cell">{fmtDate(video.addedAt) || '—'}</td>

      {playing && (
        <VideoPreviewModal
          videoId={video.id}
          title={video.title}
          onClose={() => setPlaying(false)}
        />
      )}
    </tr>
  )
}

/* ============================================================================
   ПАНЕЛЬ ПАПОК: фильтр + управление (создать / переименовать / удалить)
   ============================================================================ */
function FolderBar({
  folders,
  flatFolders,
  filter,
  onFilter,
  counts,
  onChanged,
}: {
  folders: FolderItem[]
  flatFolders: { id: number | string; title: string; depth: number }[]
  filter: string
  onFilter: (v: string) => void
  counts: { all: number; none: number }
  onChanged: () => void
}) {
  const [managing, setManaging] = useState(false)

  const filterLabel = useMemo(() => {
    if (filter === FILTER_ALL) return `Все видео (${counts.all})`
    if (filter === FILTER_NONE) return `Без папки (${counts.none})`
    const f = flatFolders.find((x) => String(x.id) === filter)
    return f ? f.title : 'Все видео'
  }, [filter, flatFolders, counts])

  return (
    <div className="folderbar">
      <div className="folderbar__filter">
        <span className="folderbar__label">Папка:</span>
        <FolderDropdown
          triggerClass="folderbar__select-btn"
          triggerContent={
            <>
              <Folder size={14} />
              <span className="folderbar__select-label">{filterLabel}</span>
              <ChevronDown size={15} className="folderbar__select-caret" />
            </>
          }
          items={[
            { value: FILTER_ALL, label: `Все видео (${counts.all})`, depth: 0, active: filter === FILTER_ALL },
            { value: FILTER_NONE, label: `Без папки (${counts.none})`, depth: 0, active: filter === FILTER_NONE },
            ...flatFolders.map((f) => ({
              value: String(f.id),
              label: f.title,
              depth: f.depth,
              active: filter === String(f.id),
            })),
          ]}
          onSelect={onFilter}
        />
      </div>
      <button
        className="studio-btn studio-btn--ghost folderbar__manage"
        onClick={() => setManaging((v) => !v)}
      >
        <Folder size={15} />
        Управление папками
        <ChevronRight size={14} className={managing ? 'folderbar__chev is-open' : 'folderbar__chev'} />
      </button>

      {managing && (
        <FolderManager
          folders={folders}
          flatFolders={flatFolders}
          onChanged={onChanged}
        />
      )}
    </div>
  )
}

/* Управление папками: список + создание + переименование + удаление */
function FolderManager({
  folders,
  flatFolders,
  onChanged,
}: {
  folders: FolderItem[]
  flatFolders: { id: number | string; title: string; depth: number }[]
  onChanged: () => void
}) {
  const [newTitle, setNewTitle] = useState('')
  const [newParent, setNewParent] = useState<string>('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<number | string | null>(null)
  const [editTitle, setEditTitle] = useState('')

  async function createFolder() {
    setError(null)
    if (!newTitle.trim()) return setError('Укажите название папки')
    setBusy(true)
    try {
      const res = await fetch('/studio/api/video-folders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ title: newTitle.trim(), parentId: newParent || null }),
      })
      const json = await res.json()
      if (!res.ok) setError(json.error || 'Не удалось создать папку')
      else {
        setNewTitle('')
        setNewParent('')
        onChanged()
      }
    } catch {
      setError('Ошибка соединения')
    } finally {
      setBusy(false)
    }
  }

  async function renameFolder(id: number | string) {
    setError(null)
    if (!editTitle.trim()) return setError('Укажите название папки')
    setBusy(true)
    try {
      const res = await fetch('/studio/api/video-folders/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id, title: editTitle.trim() }),
      })
      const json = await res.json()
      if (!res.ok) setError(json.error || 'Не удалось переименовать')
      else {
        setEditingId(null)
        setEditTitle('')
        onChanged()
      }
    } catch {
      setError('Ошибка соединения')
    } finally {
      setBusy(false)
    }
  }

  async function deleteFolder(id: number | string, title: string) {
    if (!window.confirm(`Удалить папку «${title}»? Видео из неё не удалятся, а станут «без папки».`)) return
    setError(null)
    setBusy(true)
    try {
      const res = await fetch('/studio/api/video-folders/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id }),
      })
      const json = await res.json()
      if (!res.ok) setError(json.error || 'Не удалось удалить папку')
      else onChanged()
    } catch {
      setError('Ошибка соединения')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="foldermgr">
      {/* Создание */}
      <div className="foldermgr__create">
        <input
          className="studio-input"
          placeholder="Название новой папки"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && createFolder()}
        />
        <StudioSelect
          className="foldermgr__parent"
          value={newParent}
          onChange={setNewParent}
          options={[
            { value: '', label: 'Корень (без родителя)' },
            ...flatFolders.map((f) => ({
              value: String(f.id),
              label: f.title,
              depth: f.depth,
            })),
          ]}
          ariaLabel="Родительская папка"
        />
        <button className="studio-btn studio-btn--primary" onClick={createFolder} disabled={busy}>
          {busy ? <Loader2 size={15} className="spin" /> : <FolderPlus size={15} />}
          Создать
        </button>
      </div>

      {error && <div className="studio-login__error foldermgr__error">{error}</div>}

      {/* Список папок */}
      {flatFolders.length === 0 ? (
        <div className="foldermgr__empty">Папок пока нет. Создайте первую выше.</div>
      ) : (
        <ul className="foldermgr__list">
          {flatFolders.map((f) => (
            <li key={f.id} className="foldermgr__item" style={{ paddingLeft: `${f.depth * 16}px` }}>
              <Folder size={14} className="foldermgr__item-icon" />
              {editingId === f.id ? (
                <>
                  <input
                    className="studio-input foldermgr__edit-input"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') renameFolder(f.id)
                      if (e.key === 'Escape') setEditingId(null)
                    }}
                    autoFocus
                  />
                  <button className="catmgr__icon-btn" onClick={() => renameFolder(f.id)} title="Сохранить" disabled={busy}>
                    <Check size={15} />
                  </button>
                  <button className="catmgr__icon-btn" onClick={() => setEditingId(null)} title="Отмена">
                    <X size={15} />
                  </button>
                </>
              ) : (
                <>
                  <span className="foldermgr__item-title">{f.title}</span>
                  <button
                    className="catmgr__icon-btn"
                    onClick={() => { setEditingId(f.id); setEditTitle(f.title); setError(null) }}
                    title="Переименовать"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    className="catmgr__icon-btn foldermgr__del"
                    onClick={() => deleteFolder(f.id, f.title)}
                    title="Удалить"
                    disabled={busy}
                  >
                    <Trash2 size={14} />
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/* ============================================================================
   ДОБАВЛЕНИЕ ВИДЕО (без изменений — перенесено как есть)
   ============================================================================ */
function AddPanel({
  tiers,
  onDone,
  onCancel,
}: {
  tiers: Tier[]
  onDone: () => void
  onCancel: () => void
}) {
  const [mode, setMode] = useState<'upload' | 'url'>('upload')
  const [provider, setProvider] = useState<'stream' | 'kinescope'>('kinescope')
  return (
    <div className="studio-card vid__form">
      <div className="vid__provider">
        <div className="vid__provider-label">Где хранить видео</div>
        <div className="vid__provider-opts">
          <button
            type="button"
            className={`vid__provider-opt${provider === 'kinescope' ? ' is-active' : ''}`}
            onClick={() => setProvider('kinescope')}
          >
            <span className="vid__provider-title">🇷🇺 Российское (Kinescope)</span>
            <span className="vid__provider-hint">Работает в РФ без VPN. Рекомендуется.</span>
          </button>
          <button
            type="button"
            className={`vid__provider-opt${provider === 'stream' ? ' is-active' : ''}`}
            onClick={() => setProvider('stream')}
          >
            <span className="vid__provider-title">🌍 Зарубежное (Cloudflare)</span>
            <span className="vid__provider-hint">Для зарубежной аудитории. В РФ нужен VPN.</span>
          </button>
        </div>
      </div>

      <div className="vid__tabs">
        <button
          className={`vid__tab${mode === 'upload' ? ' is-active' : ''}`}
          onClick={() => setMode('upload')}
        >
          <Upload size={15} /> Загрузить файл
        </button>
        <button
          className={`vid__tab${mode === 'url' ? ' is-active' : ''}`}
          onClick={() => setMode('url')}
        >
          <LinkIcon size={15} /> По ссылке
        </button>
      </div>

      {mode === 'upload' ? (
        <UploadFileForm provider={provider} tiers={tiers} onDone={onDone} onCancel={onCancel} />
      ) : (
        <UrlFields provider={provider} tiers={tiers} onDone={onDone} onCancel={onCancel} />
      )}
    </div>
  )
}

function UploadFileForm({
  provider,
  tiers,
  onDone,
  onCancel,
}: {
  provider: 'stream' | 'kinescope'
  tiers: Tier[]
  onDone: () => void
  onCancel: () => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [minTierId, setMinTierId] = useState('')
  const [isPreview, setIsPreview] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [pct, setPct] = useState(0)
  const [uploaded, setUploaded] = useState(0)
  const [total, setTotal] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const uploadRef = useRef<tus.Upload | null>(null)
  const xhrRef = useRef<XMLHttpRequest | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, ''))
    setError(null)
  }

  // Kinescope: файл идёт multipart через наш сервер (без TUS). Прогресс — через XHR.
  function startKinescope(f: File) {
    setUploading(true)
    setPct(0)
    setTotal(f.size)

    const fd = new FormData()
    fd.append('file', f)
    fd.append('title', title.trim())
    if (minTierId) fd.append('minTierId', minTierId)
    fd.append('isPreview', String(isPreview))

    const xhr = new XMLHttpRequest()
    xhrRef.current = xhr
    xhr.open('POST', '/studio/api/videos/kinescope/create-from-upload')
    xhr.withCredentials = true
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        setUploaded(e.loaded)
        setTotal(e.total)
        setPct(Math.round((e.loaded / e.total) * 100))
      }
    }
    xhr.onload = () => {
      xhrRef.current = null
      let json: any = {}
      try { json = JSON.parse(xhr.responseText) } catch {}
      if (xhr.status >= 200 && xhr.status < 300 && json.ok) {
        onDone()
      } else {
        setError(json.error || `Не удалось загрузить (HTTP ${xhr.status})`)
        setUploading(false)
      }
    }
    xhr.onerror = () => {
      xhrRef.current = null
      setError('Ошибка соединения при загрузке')
      setUploading(false)
    }
    xhr.send(fd)
  }

  async function start() {
    setError(null)
    if (!file) return setError('Выберите файл')
    if (!title.trim()) return setError('Укажите название')

    // Российское хранилище — простой multipart-путь
    if (provider === 'kinescope') {
      startKinescope(file)
      return
    }

    setUploading(true)
    setPct(0)
    setTotal(file.size)

    try {
      const res = await fetch('/studio/api/videos/tus-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ size: file.size, name: title.trim() }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || 'Не удалось начать загрузку')
        setUploading(false)
        return
      }
      const { uploadURL, uid } = json

      const upload = new tus.Upload(file, {
        uploadUrl: uploadURL,
        chunkSize: 50 * 1024 * 1024,
        retryDelays: [0, 3000, 5000, 10000, 20000],
        metadata: { filename: file.name, filetype: file.type },
        onError(err) {
          setError(`Ошибка загрузки: ${err?.message || 'соединение прервано'}`)
          setUploading(false)
        },
        onProgress(bytesUploaded, bytesTotal) {
          setUploaded(bytesUploaded)
          setTotal(bytesTotal)
          setPct(Math.round((bytesUploaded / bytesTotal) * 100))
        },
        async onSuccess() {
          try {
            const cr = await fetch('/studio/api/videos/create-from-upload', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({
                uid,
                title: title.trim(),
                minTierId: minTierId || null,
                isPreview,
              }),
            })
            const cj = await cr.json()
            if (!cr.ok) {
              setError(cj.error || 'Файл залит, но запись создать не удалось')
              setUploading(false)
              return
            }
            onDone()
          } catch {
            setError('Файл залит, но запись создать не удалось')
            setUploading(false)
          }
        },
      })
      uploadRef.current = upload
      upload.start()
    } catch {
      setError('Ошибка соединения')
      setUploading(false)
    }
  }

  function cancel() {
    if (uploadRef.current) {
      uploadRef.current.abort()
      uploadRef.current = null
    }
    if (xhrRef.current) {
      xhrRef.current.abort()
      xhrRef.current = null
    }
    setUploading(false)
    setPct(0)
    onCancel()
  }

  const mb = (b: number) => (b / 1024 / 1024).toFixed(1)

  return (
    <>
      <p className="vid__form-hint">
        Загрузка идёт напрямую в Cloudflare Stream, минуя наш сервер. Большие файлы
        докачиваются при обрыве связи.
      </p>

      {!file ? (
        <button
          className="vid__drop"
          onClick={() => fileInput.current?.click()}
          type="button"
        >
          <Upload size={22} />
          <span>Выбрать видеофайл</span>
          <span className="vid__drop-hint">MP4, MOV, WebM и др.</span>
        </button>
      ) : (
        <div className="vid__file">
          <VideoIcon size={18} />
          <span className="vid__file-name">{file.name}</span>
          <span className="vid__file-size">{mb(file.size)} МБ</span>
          {!uploading && (
            <button className="catmgr__icon-btn" onClick={() => setFile(null)} title="Убрать">
              <X size={15} />
            </button>
          )}
        </div>
      )}
      <input
        ref={fileInput}
        type="file"
        accept="video/*"
        onChange={pickFile}
        style={{ display: 'none' }}
      />

      <label className="studio-field">
        <span className="studio-field__label">Название</span>
        <input
          className="studio-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={uploading}
        />
      </label>

      <div className="vid__form-row">
        <label className="studio-field" style={{ flex: 1 }}>
          <span className="studio-field__label">Уровень доступа</span>
          <StudioSelect
            value={minTierId}
            onChange={setMinTierId}
            options={[
              { value: '', label: 'Все подписчики / бесплатно' },
              ...tiers.map((t) => ({ value: String(t.id), label: `${t.name} и выше` })),
            ]}
            disabled={isPreview || uploading}
            ariaLabel="Уровень доступа"
          />
        </label>
        <label className="vid__preview-check">
          <input
            type="checkbox"
            checked={isPreview}
            onChange={(e) => setIsPreview(e.target.checked)}
            disabled={uploading}
          />
          Бесплатное превью
        </label>
      </div>

      {uploading && (
        <div className="vid__progress">
          <div className="vid__progress-bar">
            <div className="vid__progress-fill" style={{ width: `${pct}%` }} />
          </div>
          <div className="vid__progress-text">
            {pct}% · {mb(uploaded)} / {mb(total)} МБ
          </div>
        </div>
      )}

      {error && <div className="studio-login__error">{error}</div>}

      <div className="vid__form-actions">
        <button className="studio-btn studio-btn--ghost" onClick={cancel}>
          {uploading ? 'Прервать' : 'Отмена'}
        </button>
        {!uploading && (
          <button className="studio-btn studio-btn--primary" onClick={start} disabled={!file}>
            <Upload size={16} /> Загрузить
          </button>
        )}
      </div>
    </>
  )
}

function UrlFields({
  provider,
  tiers,
  onDone,
  onCancel,
}: {
  provider: 'stream' | 'kinescope'
  tiers: Tier[]
  onDone: () => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [minTierId, setMinTierId] = useState('')
  const [isPreview, setIsPreview] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    setError(null)
    if (!title.trim()) return setError('Укажите название')
    if (!url.trim()) return setError('Укажите ссылку на видеофайл')
    setBusy(true)
    try {
      const endpoint =
        provider === 'kinescope'
          ? '/studio/api/videos/kinescope/create-from-url'
          : '/studio/api/videos/create-from-url'
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: title.trim(),
          url: url.trim(),
          minTierId: minTierId || null,
          isPreview,
        }),
      })
      const json = await res.json()
      if (!res.ok) setError(json.error || 'Не удалось добавить видео')
      else onDone()
    } catch {
      setError('Ошибка соединения')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <p className="vid__form-hint">
        {provider === 'kinescope'
          ? 'Ссылка на видео: Яндекс.Диск (публичная), Object Storage, S3, YouTube. Kinescope скачает и подготовит сам.'
          : 'Ссылка на видео из вашего хранилища: Яндекс.Диск (публичная ссылка), Яндекс Object Storage, R2 или S3. Cloudflare Stream скачает и подготовит сам.'}
      </p>
      <label className="studio-field">
        <span className="studio-field__label">Название</span>
        <input className="studio-input" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
      </label>
      <label className="studio-field">
        <span className="studio-field__label">Ссылка на видео</span>
        <input
          className="studio-input"
          placeholder="https://disk.yandex.ru/i/... или https://storage.yandexcloud.net/.../video.mp4"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
      </label>
      <div className="vid__form-row">
        <label className="studio-field" style={{ flex: 1 }}>
          <span className="studio-field__label">Уровень доступа</span>
          <StudioSelect
            value={minTierId}
            onChange={setMinTierId}
            options={[
              { value: '', label: 'Все подписчики / бесплатно' },
              ...tiers.map((t) => ({ value: String(t.id), label: `${t.name} и выше` })),
            ]}
            disabled={isPreview}
            ariaLabel="Уровень доступа"
          />
        </label>
        <label className="vid__preview-check">
          <input type="checkbox" checked={isPreview} onChange={(e) => setIsPreview(e.target.checked)} />
          Бесплатное превью
        </label>
      </div>
      {error && <div className="studio-login__error">{error}</div>}
      <div className="vid__form-actions">
        <button className="studio-btn studio-btn--ghost" onClick={onCancel}>Отмена</button>
        <button className="studio-btn studio-btn--primary" onClick={submit} disabled={busy}>
          {busy ? <Loader2 size={16} className="spin" /> : <Plus size={16} />}
          Добавить
        </button>
      </div>
    </>
  )
}
