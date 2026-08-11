'use client'

import React, { useState, useEffect, useRef, useMemo, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import * as tus from 'tus-js-client'
import {
  Plus, Video as VideoIcon, Loader2, Check, Clock, Link as LinkIcon, Lock, Unlock,
  Upload, X, Play, Folder, Pencil, ChevronRight, ChevronDown,
  ChevronLeft, Search, MapPin, Globe, AlertTriangle,
} from 'lucide-react'
import { VideoPreviewModal } from './VideoPreviewModal'
import { StudioSelect } from '../_ui/StudioSelect'

type Tier = { id: number | string; name: string }
type FolderItem = { id: number | string; title: string; parentId: number | string | null }
type Vid = {
  id: number | string
  title: string
  videoRef: string | null
  /** 'stream' | 'kinescope' | 'embed'. У embed файла в хранилище нет. */
  provider?: string
  embedProvider?: string | null
  embedSrc?: string | null
  embedAspect?: string | null
  /** Статус доступности внешней вставки: 'ok' | 'unavailable' | 'unknown' | null. */
  embedStatus?: string | null
  /** Статус обработки своего видео: 'uploading'|'processing'|'ready'|'error'|null. */
  assetStatus?: string | null
  isPreview: boolean
  minTierName: string | null
  minTierId: string
  durationSec: number | null
  coverUrl: string | null
  previewGif?: string | null
  addedAt: string | null
  season: number | null
  episode: number | null
  categoryId: string
  tags: string[]
  usedIn: { id: number | string; title: string }[]
  playbackId?: string | null
  subtitles?: { lang: string; label: string }[]
  summary?: { tldr?: string; points?: string[]; at?: string; edited?: boolean } | null
  chapters?: { start: number; title: string }[]
}

const FILTER_ALL = '__all__'
const FILTER_NONE = '__none__'
const FILTER_UNAVAILABLE = '__unavailable__'

function fmtDur(sec: number | null): string {
  if (!sec) return ''
  const m = Math.floor(sec / 60)
  const s = Math.round(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

function fmtDate(iso: string | null): string {
  if (!iso) return ''
  try {
    // ВАЖНО: фиксируем timeZone. Без неё сервер (UTC) и браузер (MSK) для
    // даты у полуночной границы форматируют РАЗНЫЙ день → hydration mismatch
    // (React #418): SSR-дерево отбрасывается и перерисовывается — тёмная вспышка.
    return new Date(iso).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'Europe/Moscow',
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
  categories: initialCategories,
  canCreate = true,
}: {
  initialVideos: Vid[]
  tiers: Tier[]
  categories: FolderItem[]
  canCreate?: boolean
}) {
  const router = useRouter()
  const [videos, setVideos] = useState<Vid[]>(initialVideos)
  const [categories, setCategories] = useState<FolderItem[]>(initialCategories)

  // после router.refresh() приходят свежие данные — синхронизируем
  useEffect(() => setVideos(initialVideos), [initialVideos])
  // Пока есть видео в обработке (self) — ЛЕГКО опрашиваем только их статус и
  // обновляем строки на месте. Раньше тут был router.refresh() каждые 10с — он
  // перезагружал всю страницу (214 видео) и мигал экраном (тёмная вспышка).
  useEffect(() => {
    const procIds = videos
      .filter((v) => v.assetStatus === 'processing' || v.assetStatus === 'uploading')
      .map((v) => v.id)
    if (procIds.length === 0) return
    let cancelled = false
    const poll = async () => {
      try {
        const res = await fetch(`/studio/api/videos/status?ids=${procIds.join(',')}`, {
          credentials: 'include',
          cache: 'no-store',
        })
        if (!res.ok || cancelled) return
        const json = await res.json()
        const statuses = (json?.statuses || {}) as Record<string, string | null>
        setVideos((prev) => {
          let changed = false
          const next = prev.map((v) => {
            const st = statuses[String(v.id)]
            if (st && st !== v.assetStatus) { changed = true; return { ...v, assetStatus: st } }
            return v
          })
          return changed ? next : prev
        })
      } catch {
        /* сеть — не критично, повторим */
      }
    }
    const id = setInterval(poll, 8000)
    return () => { cancelled = true; clearInterval(id) }
  }, [videos])
  useEffect(() => setCategories(initialCategories), [initialCategories])

  const [adding, setAdding] = useState(false)
  const [filter, setFilter] = useState<string>(FILTER_ALL) // FILTER_ALL | FILTER_NONE | categoryId

  const flatCategories = useMemo(() => flattenFolders(categories), [categories])
  // id категории → полный путь: «Смотреть › Шоу и проекты › In the SOOP».
  const catPathById = useMemo(() => {
    const byId = new Map<string, FolderItem>()
    for (const c of categories) byId.set(String(c.id), c)
    const m = new Map<string, string>()
    for (const c of categories) {
      const parts: string[] = []
      let cur: FolderItem | undefined = c
      let guard = 0
      while (cur && guard < 20) {
        parts.unshift(cur.title)
        cur = cur.parentId == null ? undefined : byId.get(String(cur.parentId))
        guard += 1
      }
      m.set(String(c.id), parts.join(' › '))
    }
    return m
  }, [categories])

  const noSectionCount = useMemo(() => videos.filter((v) => !v.categoryId).length, [videos])
  // Кол-во видео с недоступной внешней вставкой (VK удалил/ограничил) —
  // чтобы автор быстро нашёл битые и разобрался.
  const unavailableCount = useMemo(
    () => videos.filter((v) => v.embedStatus === 'unavailable').length,
    [videos],
  )

  const visibleVideos = useMemo(() => {
    if (filter === FILTER_ALL) return videos
    if (filter === FILTER_NONE) return videos.filter((v) => !v.categoryId)
    if (filter === FILTER_UNAVAILABLE) return videos.filter((v) => v.embedStatus === 'unavailable')
    return videos.filter((v) => String(v.categoryId) === filter)
  }, [videos, filter])

  const sectionFilterLabel = useMemo(() => {
    if (filter === FILTER_ALL) return `Все видео (${videos.length})`
    if (filter === FILTER_NONE) return `Без раздела (${noSectionCount})`
    if (filter === FILTER_UNAVAILABLE) return `Недоступные (${unavailableCount})`
    const c = flatCategories.find((x) => String(x.id) === filter)
    return c ? c.title : 'Все видео'
  }, [filter, flatCategories, videos.length, noSectionCount, unavailableCount])

  return (
    <>
      <div className="studio-page-head">
        <div>
          <h1>Видео</h1>
          <div className="studio-page-head__sub">Всего: {videos.length}</div>
        </div>
        {canCreate && (
        <button className="studio-btn studio-btn--primary" onClick={() => setAdding((v) => !v)}>
          <Plus size={18} />
          Добавить видео
        </button>
        )}
      </div>

      {adding && (
        <AddPanel
          tiers={tiers}
          categories={flatCategories}
          onDone={() => {
            setAdding(false)
            router.refresh()
          }}
          onCancel={() => setAdding(false)}
        />
      )}

      {/* Фильтр по разделу «Смотреть» (заменил фильтр по папкам). */}
      <div className="folderbar">
        <div className="folderbar__filter">
          <span className="folderbar__label">Раздел:</span>
          <FolderDropdown
            triggerClass="folderbar__select-btn"
            triggerContent={
              <>
                <Folder size={14} />
                <span className="folderbar__select-label">{sectionFilterLabel}</span>
                <ChevronDown size={15} className="folderbar__select-caret" />
              </>
            }
            items={[
              { value: FILTER_ALL, label: `Все видео (${videos.length})`, depth: 0, active: filter === FILTER_ALL },
              { value: FILTER_NONE, label: `Без раздела (${noSectionCount})`, depth: 0, active: filter === FILTER_NONE },
              ...(unavailableCount > 0
                ? [{ value: FILTER_UNAVAILABLE, label: `⚠ Недоступные (${unavailableCount})`, depth: 0, active: filter === FILTER_UNAVAILABLE }]
                : []),
              ...flatCategories.map((c) => ({
                value: String(c.id),
                label: c.title,
                depth: c.depth,
                active: filter === String(c.id),
              })),
            ]}
            onSelect={setFilter}
          />
        </div>
      </div>

      {videos.length === 0 ? (
        <div className="studio-empty">
          <div className="studio-empty__icon"><VideoIcon size={28} /></div>
          <div className="studio-empty__title">Видео пока нет</div>
          <div className="studio-empty__text">Добавьте первое видео по ссылке из вашего хранилища.</div>
        </div>
      ) : visibleVideos.length === 0 ? (
        <div className="studio-empty">
          <div className="studio-empty__icon"><Folder size={28} /></div>
          <div className="studio-empty__title">В этом разделе пусто</div>
          <div className="studio-empty__text">Задайте видео раздел «Смотреть» в карандаше (там же сезон и эпизод).</div>
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
                <th className="vidtable__th-pubs">Публикации</th>
                <th className="vidtable__th-folder">Раздел</th>
                <th className="vidtable__th-date">Добавлено</th>
                <th className="vidtable__th-actions"></th>
              </tr>
            </thead>
            <tbody>
              {visibleVideos.map((v) => (
                <VideoRow
                  key={v.id}
                  video={v}
                  categoryPath={v.categoryId ? catPathById.get(String(v.categoryId)) || null : null}
                  onEdit={() => router.push(`/studio/videos/${v.id}`)}
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
  categoryPath,
  onEdit,
}: {
  video: Vid
  categoryPath: string | null
  onEdit: () => void
}) {
  const [ready, setReady] = useState<boolean | null>(null)
  const [pct, setPct] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const timer = useRef<any>(null)

  // Внешняя вставка не кодируется — она играбельна сразу. Без этой ветки
  // опрос статуса пропускался (videoRef пуст), ready навсегда оставался null,
  // и каждое добавленное видео выглядело сломанным: «Нет файла» и
  // заблокированное превью.
  const isEmbed = video.provider === 'embed'
  const isSelf = video.provider === 'self'
  useEffect(() => {
    if (isEmbed) {
      setReady(true)
      return
    }
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
  }, [video.id, video.videoRef, isEmbed])

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
          {video.previewGif && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={video.previewGif} alt="" aria-hidden loading="lazy" className="vidtable__thumb-gif" />
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
        {video.embedStatus === 'unavailable' && (
          <span className="vid-badge-unavail" title="Внешняя вставка недоступна — VK удалил видео или ограничил доступ">
            <AlertTriangle size={11} /> недоступно
          </span>
        )}
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
        {isSelf ? (
          video.assetStatus === 'ready' ? (
            <span className="vid__status vid__status--ok"><Check size={13} /> Готово</span>
          ) : video.assetStatus === 'error' ? (
            <span className="vid__status vid__status--wait"><Clock size={13} /> Ошибка обработки</span>
          ) : (
            <span className="vid__status vid__status--wait"><Loader2 size={13} className="spin" /> Обрабатывается</span>
          )
        ) : (
          <>
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
            {ready === null && !video.videoRef && !isEmbed && (
              <span className="vid__status vid__status--wait"><Clock size={13} /> Нет файла</span>
            )}
          </>
        )}
      </td>

      {/* Публикации (счётчик) */}
      <td className="vidtable__pubs-cell">
        {video.usedIn.length > 0 ? (
          <button
            className="vidtable__pubs-badge"
            onClick={onEdit}
            title={`Прикреплено к публикациям: ${video.usedIn.length}`}
          >
            {video.usedIn.length}
          </button>
        ) : (
          <span className="vidtable__pubs-badge is-empty" title="Не прикреплено ни к одной публикации">0</span>
        )}
      </td>

      {/* Раздел «Смотреть» — задаётся в модалке вместе с сезоном/эпизодом */}
      <td className="vidtable__folder-cell">
        <button
          type="button"
          className={`vidtable__folder-btn${categoryPath ? '' : ' is-empty'}`}
          onClick={onEdit}
          title="Изменить раздел, сезон и эпизод"
        >
          {categoryPath ? (
            <><Folder size={13} /> <span className="vidtable__folder-name">{categoryPath}</span></>
          ) : (
            <span className="vidtable__folder-empty">— выбрать —</span>
          )}
        </button>
      </td>

      {/* Дата */}
      <td className="vidtable__date-cell">{fmtDate(video.addedAt) || '—'}</td>

      {/* Действия */}
      <td className="vidtable__actions-cell">
        <button
          className="catmgr__icon-btn"
          onClick={onEdit}
          title="Редактировать видео"
        >
          <Pencil size={15} />
        </button>
      </td>

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
   ДОБАВЛЕНИЕ ВИДЕО (без изменений — перенесено как есть)
   ============================================================================ */
type MetaCat = { id: number | string; title: string; depth: number }

/** Общий блок метаданных при добавлении видео: категория (дерево) + сезон +
 *  серия + теги. Прикрепление к публикации остаётся в редакторе видео. */
function VideoMetaFields({
  categories, categoryId, setCategoryId, season, setSeason, episode, setEpisode, tags, setTags,
}: {
  categories: MetaCat[]
  categoryId: string; setCategoryId: (v: string) => void
  season: string; setSeason: (v: string) => void
  episode: string; setEpisode: (v: string) => void
  tags: string[]; setTags: (v: string[]) => void
}) {
  const [tagInput, setTagInput] = useState('')
  const addTag = () => { const t = tagInput.trim(); if (t && !tags.includes(t)) setTags([...tags, t]); setTagInput('') }
  return (
    <>
      <label className="studio-field">
        <span className="studio-field__label">Раздел / категория</span>
        <StudioSelect value={categoryId} onChange={setCategoryId} ariaLabel="Категория"
          options={[{ value: '', label: '\u2014 без категории \u2014' }, ...categories.map((c) => ({ value: String(c.id), label: c.title, depth: c.depth }))]} />
      </label>
      <div style={{ display: 'flex', gap: 12 }}>
        <label className="studio-field" style={{ flex: 1 }}>
          <span className="studio-field__label">Сезон</span>
          <input className="studio-input" type="number" min={0} value={season} onChange={(e) => setSeason(e.target.value)} />
        </label>
        <label className="studio-field" style={{ flex: 1 }}>
          <span className="studio-field__label">Серия / эпизод</span>
          <input className="studio-input" type="number" min={0} value={episode} onChange={(e) => setEpisode(e.target.value)} />
        </label>
      </div>
      <div className="studio-field">
        <span className="studio-field__label">Теги</span>
        {tags.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
            {tags.map((t) => (
              <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 'var(--st-radius-sm)', background: 'var(--st-surface-hover)', fontSize: 'var(--st-text-sm)' }}>
                {t}<button type="button" onClick={() => setTags(tags.filter((x) => x !== t))} style={{ border: 0, background: 'transparent', cursor: 'pointer', display: 'grid', placeItems: 'center', color: 'var(--st-text-muted)' }}><X size={12} /></button>
              </span>
            ))}
          </div>
        )}
        <input className="studio-input" placeholder="Добавить тег и Enter" value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }} />
      </div>
    </>
  )
}

export function AddPanel({
  tiers,
  categories,
  onDone,
  onCancel,
  onCreated,
}: {
  tiers: Tier[]
  categories: MetaCat[]
  onDone: () => void
  onCancel: () => void
  /** Вызывается с созданной записью — для авто-прикрепления из композера. */
  onCreated?: (v: { id: number | string; title: string }) => void
}) {
  const [mode, setMode] = useState<'upload' | 'url' | 'library'>('upload')
  const [provider, setProvider] = useState<'self' | 'stream' | 'kinescope' | 'embed'>('self')
  // Вкладка «Библиотека» есть только у Kinescope. При переключении на Cloudflare
  // возвращаемся к загрузке, чтобы не остаться на скрытой вкладке.
  useEffect(() => {
    if (provider !== 'kinescope' && mode === 'library') setMode('upload')
  }, [provider, mode])
  return (
    <div className="studio-card vid__form">
      <div className="vid__provider">
        <div className="vid__provider-label">Где хранится видео</div>
        <div className="vid__provider-opts">
          <button
            type="button"
            className={`vid__provider-opt${provider === 'self' ? ' is-active' : ''}`}
            onClick={() => setProvider('self')}
          >
            <span className="vid__provider-title">
              <MapPin size={15} className="vid__provider-icon" /> Для России
            </span>
            <span className="vid__provider-hint">Загружаем видео к себе и готовим к просмотру (HLS, качество под зрителя). Работает в РФ без VPN. Нужно подождать обработку. Рекомендуется.</span>
          </button>
          <button
            type="button"
            className="vid__provider-opt is-muted"
            onClick={() => {}}
            disabled
            aria-disabled="true"
            title="Доступно по запросу"
            style={{ opacity: 0.55, cursor: 'not-allowed' }}
          >
            <span className="vid__provider-title">
              <Globe size={15} className="vid__provider-icon" /> Для заграницы
              <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, padding: '1px 8px', borderRadius: 999, background: 'var(--st-surface-2, rgba(128,128,128,.16))', color: 'var(--st-text-muted, #8a8a8a)', textTransform: 'uppercase', letterSpacing: '.04em', verticalAlign: 'middle' }}>по запросу</span>
            </span>
            <span className="vid__provider-hint">Для зарубежной аудитории. В РФ нужен VPN. Подключается по запросу.</span>
          </button>
          <button
            type="button"
            className={`vid__provider-opt${provider === 'embed' ? ' is-active' : ''}`}
            onClick={() => setProvider('embed')}
          >
            <span className="vid__provider-title">
              <LinkIcon size={15} className="vid__provider-icon" /> Внешнее видео
            </span>
            <span className="vid__provider-hint">Показываем видео с VK или Дзена, не копируя к себе. Всегда бесплатно для всех.</span>
          </button>
        </div>
      </div>

      {provider === 'embed' || provider === 'self' ? null : (
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
        {provider === 'kinescope' && (
          <button
            className={`vid__tab${mode === 'library' ? ' is-active' : ''}`}
            onClick={() => setMode('library')}
          >
            <VideoIcon size={15} /> Библиотека
          </button>
        )}
      </div>
      )}

      {provider === 'self' ? (
        <SelfUploadForm tiers={tiers} categories={categories} onDone={onDone} onCancel={onCancel} onCreated={onCreated} />
      ) : provider === 'embed' ? (
        <EmbedFields tiers={tiers} categories={categories} onDone={onDone} onCancel={onCancel} onCreated={onCreated} />
      ) : mode === 'upload' ? (
        <UploadFileForm provider={provider} tiers={tiers} categories={categories} onDone={onDone} onCancel={onCancel} onCreated={onCreated} />
      ) : mode === 'url' ? (
        <UrlFields provider={provider} tiers={tiers} categories={categories} onDone={onDone} onCancel={onCancel} onCreated={onCreated} />
      ) : (
        <KinescopeLibrary onDone={onDone} onCancel={onCancel} />
      )}
    </div>
  )
}

type KinescopeLibItem = {
  id: string
  title: string
  status?: string
  ready: boolean
  duration?: number
  posterUrl: string | null
}

type KinFolder = { id: string; name: string; parentId: string | null }

/**
 * Пикер библиотеки Kinescope. Таблица уже загруженных (через app.kinescope.io)
 * видео с превью/длительностью/статусом, поиском и пагинацией. Папки —
 * с вложенностью (хлебные крошки, навигация по parent_id). Мультивыбор
 * чекбоксами + «Импортировать · N» (создаёт записи provider=kinescope +
 * videoRef). Уровень доступа/категорию задаём потом в редакторе видео.
 */
function KinescopeLibrary({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [items, setItems] = useState<KinescopeLibItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [perPage, setPerPage] = useState(24)
  const [added, setAdded] = useState<Set<string>>(new Set())
  const [importedCount, setImportedCount] = useState(0)
  const [importing, setImporting] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [allFolders, setAllFolders] = useState<KinFolder[]>([])
  const [path, setPath] = useState<{ id: string; name: string }[]>([])

  const currentFolderId = path.length ? path[path.length - 1]!.id : null
  const searching = debounced.length > 0
  const subFolders = searching
    ? []
    : allFolders
        .filter((f) => (f.parentId ?? null) === currentFolderId)
        .sort((a, b) => a.name.localeCompare(b.name, 'ru'))

  // Папки один раз при открытии.
  useEffect(() => {
    let cancelled = false
    fetch('/studio/api/videos/kinescope/folders', { credentials: 'include', cache: 'no-store' })
      .then(async (res) => {
        const json = await res.json().catch(() => null)
        if (cancelled || !res.ok) return
        setAllFolders(Array.isArray(json?.folders) ? json.folders : [])
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  // Дебаунс поиска: сбрасываем на первую страницу.
  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(query.trim())
      setPage(1)
    }, 400)
    return () => clearTimeout(t)
  }, [query])

  // Список видео. При поиске — по всему аккаунту; иначе — по текущей папке
  // (в корне — видео вне папок).
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    const qs = new URLSearchParams({ page: String(page) })
    if (searching) qs.set('q', debounced)
    else if (currentFolderId) qs.set('folderId', currentFolderId)
    else qs.set('withoutFolder', '1')
    fetch(`/studio/api/videos/kinescope/library?${qs.toString()}`, {
      credentials: 'include',
      cache: 'no-store',
    })
      .then(async (res) => {
        const json = await res.json().catch(() => null)
        if (cancelled) return
        if (!res.ok) {
          setItems([])
          setError(json?.error || `Не удалось загрузить список (HTTP ${res.status})`)
          return
        }
        setItems(Array.isArray(json?.items) ? json.items : [])
        setTotal(Number(json?.total) || 0)
        setPerPage(Number(json?.perPage) || 24)
      })
      .catch(() => {
        if (!cancelled) setError('Не удалось связаться с сервером')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [page, debounced, currentFolderId, searching])

  function openFolder(f: KinFolder) {
    setPath((p) => [...p, { id: f.id, name: f.name }])
    setPage(1)
    setSelected(new Set())
  }
  function crumbTo(index: number) {
    setPath((p) => (index < 0 ? [] : p.slice(0, index + 1)))
    setPage(1)
    setSelected(new Set())
  }

  const selectableIds = items.filter((v) => !added.has(v.id)).map((v) => v.id)
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selected.has(id))

  function toggleSelect(id: string) {
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }
  function toggleSelectAll() {
    setSelected((s) => {
      const n = new Set(s)
      if (allSelected) selectableIds.forEach((id) => n.delete(id))
      else selectableIds.forEach((id) => n.add(id))
      return n
    })
  }

  async function importSelected() {
    const ids = [...selected].filter((id) => !added.has(id))
    if (ids.length === 0 || importing) return
    setImporting(true)
    setError(null)
    let ok = 0
    for (const id of ids) {
      const v = items.find((i) => i.id === id)
      try {
        const res = await fetch('/studio/api/videos/kinescope/import', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ videoId: id, title: v?.title }),
        })
        if (res.ok) ok++
        if (res.ok || res.status === 409) {
          setAdded((a) => {
            const n = new Set(a)
            n.add(id)
            return n
          })
        } else {
          const j = await res.json().catch(() => null)
          setError(j?.error || `Ошибка импорта (HTTP ${res.status})`)
        }
      } catch {
        setError('Не удалось связаться с сервером')
      }
    }
    setImportedCount((c) => c + ok)
    setSelected(new Set())
    setImporting(false)
  }

  const totalPages = Math.max(1, Math.ceil(total / perPage))

  return (
    <div className="kinlib">
      <div className="kinlib__search">
        <Search size={15} />
        <input
          className="kinlib__search-input"
          placeholder="Поиск по названию…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {!searching && (
        <div className="kinlib__crumbs">
          <button type="button" className="kinlib__crumb" onClick={() => crumbTo(-1)}>
            Все
          </button>
          {path.map((c, i) => (
            <span key={c.id} className="kinlib__crumb-wrap">
              <ChevronRight size={13} className="kinlib__crumb-sep" />
              <button type="button" className="kinlib__crumb" onClick={() => crumbTo(i)} title={c.name}>
                {c.name}
              </button>
            </span>
          ))}
        </div>
      )}

      {error && <div className="studio-login__error kinlib__error">{error}</div>}

      {loading ? (
        <div className="kinlib__state">
          <Loader2 size={20} className="spin" /> Загрузка…
        </div>
      ) : (
        <div className="kinlib__table">
          <div className="kinlib__row kinlib__row--head">
            <div className="kinlib__cell-check">
              <button
                type="button"
                className={`kinlib__check${allSelected ? ' is-on' : ''}`}
                onClick={toggleSelectAll}
                disabled={selectableIds.length === 0}
                aria-label="Выбрать все"
              >
                <Check size={12} />
              </button>
            </div>
            <div className="kinlib__cell-thumb" />
            <div className="kinlib__cell-title kinlib__th">Название</div>
            <div className="kinlib__cell-dur kinlib__th">Длит.</div>
            <div className="kinlib__cell-status kinlib__th">Статус</div>
          </div>

          {subFolders.map((f) => (
            <button
              type="button"
              key={f.id}
              className="kinlib__row kinlib__row--folder"
              onClick={() => openFolder(f)}
            >
              <div className="kinlib__cell-check" />
              <div className="kinlib__cell-thumb">
                <span className="kinlib__folder-ic">
                  <Folder size={18} />
                </span>
              </div>
              <div className="kinlib__cell-title kinlib__folder-name">{f.name}</div>
              <div className="kinlib__cell-dur" />
              <div className="kinlib__cell-status">
                <ChevronRight size={16} />
              </div>
            </button>
          ))}

          {items.length === 0 && subFolders.length === 0 ? (
            <div className="kinlib__state">
              {searching ? 'Ничего не найдено.' : 'Здесь пусто.'}
            </div>
          ) : (
            items.map((v) => {
              const isAdded = added.has(v.id)
              const isSel = selected.has(v.id)
              return (
                <div
                  key={v.id}
                  className={`kinlib__row${isAdded ? ' is-added' : ''}${isSel ? ' is-selected' : ''}`}
                  onClick={() => !isAdded && toggleSelect(v.id)}
                  role="button"
                >
                  <div className="kinlib__cell-check">
                    <span
                      className={`kinlib__check${isSel ? ' is-on' : ''}${isAdded ? ' is-done' : ''}`}
                    >
                      <Check size={12} />
                    </span>
                  </div>
                  <div className="kinlib__cell-thumb">
                    {v.posterUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={v.posterUrl} alt="" loading="lazy" />
                    ) : (
                      <span className="kinlib__thumb-empty">
                        <VideoIcon size={18} />
                      </span>
                    )}
                    {v.duration ? <span className="kinlib__dur">{fmtDur(v.duration ?? null)}</span> : null}
                  </div>
                  <div className="kinlib__cell-title" title={v.title}>
                    {v.title}
                  </div>
                  <div className="kinlib__cell-dur">{fmtDur(v.duration ?? null) || '—'}</div>
                  <div className="kinlib__cell-status">
                    {isAdded ? (
                      <span className="kinlib__st-added">Добавлено</span>
                    ) : v.ready ? (
                      <span className="kinlib__st-ok">Готово</span>
                    ) : (
                      <span className="kinlib__st-proc">обработка</span>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {totalPages > 1 && (
        <div className="kinlib__pager">
          <button
            type="button"
            className="studio-btn studio-btn--ghost"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft size={16} /> Назад
          </button>
          <span className="kinlib__page">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            className="studio-btn studio-btn--ghost"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((p) => p + 1)}
          >
            Вперёд <ChevronRight size={16} />
          </button>
        </div>
      )}

      <div className="kinlib__foot">
        <button type="button" className="studio-btn studio-btn--ghost" onClick={onCancel}>
          Отмена
        </button>
        {selected.size > 0 ? (
          <button
            type="button"
            className="studio-btn studio-btn--primary"
            onClick={importSelected}
            disabled={importing}
          >
            {importing ? <Loader2 size={16} className="spin" /> : <Plus size={16} />} Импортировать ·{' '}
            {selected.size}
          </button>
        ) : (
          <button type="button" className="studio-btn studio-btn--primary" onClick={onDone}>
            <Check size={16} /> Готово{importedCount > 0 ? ` · ${importedCount}` : ''}
          </button>
        )}
      </div>
    </div>
  )
}

function UploadFileForm({
  provider,
  tiers,
  categories,
  onDone,
  onCancel,
  onCreated,
}: {
  provider: 'stream' | 'kinescope'
  tiers: Tier[]
  categories: MetaCat[]
  onDone: () => void
  onCancel: () => void
  onCreated?: (v: { id: number | string; title: string }) => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  // Своё видео обязано быть платным — по умолчанию берём самый дешёвый
  // уровень; «бесплатного» варианта в списке нет.
  const [minTierId, setMinTierId] = useState<string>(() => (tiers[0] ? String(tiers[0].id) : ''))
  const [categoryId, setCategoryId] = useState('')
  const [season, setSeason] = useState('')
  const [episode, setEpisode] = useState('')
  const [tags, setTags] = useState<string[]>([])
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
    // Своё видео не бывает бесплатным превью — сервер это форсит, шлём false.
    fd.append('isPreview', String(false))
    if (categoryId) fd.append('categoryId', categoryId)
    if (season.trim()) fd.append('season', season.trim())
    if (episode.trim()) fd.append('episode', episode.trim())
    if (tags.length) fd.append('tags', tags.join(','))

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
        if (json.id != null) onCreated?.({ id: json.id, title: title.trim() })
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
    if (!minTierId) return setError('Выберите уровень доступа — своё видео доступно только по подписке')

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
                isPreview: false,
                categoryId: categoryId || null,
                season: season.trim() || null,
                episode: episode.trim() || null,
                tags,
              }),
            })
            const cj = await cr.json()
            if (!cr.ok) {
              setError(cj.error || 'Файл залит, но запись создать не удалось')
              setUploading(false)
              return
            }
            if (cj.id != null) onCreated?.({ id: cj.id, title: title.trim() })
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
        Загрузка идёт напрямую в хранилище, минуя наш сервер. Большие файлы
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
              { value: '', label: tiers.length ? '— выберите уровень —' : 'Сначала создайте уровень подписки' },
              ...tiers.map((t) => ({ value: String(t.id), label: `${t.name} и выше` })),
            ]}
            disabled={uploading}
            ariaLabel="Уровень доступа"
          />
          <div className="studio-field__hint" style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
            Своё видео доступно только по подписке — оно занимает наше хранилище
            и транскодинг. Бесплатно можно показывать лишь внешнее видео.
          </div>
        </label>
      </div>

      {!uploading && (
        <VideoMetaFields
          categories={categories}
          categoryId={categoryId} setCategoryId={setCategoryId}
          season={season} setSeason={setSeason}
          episode={episode} setEpisode={setEpisode}
          tags={tags} setTags={setTags}
        />
      )}

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
  categories,
  onDone,
  onCancel,
  onCreated,
}: {
  provider: 'stream' | 'kinescope'
  tiers: Tier[]
  categories: MetaCat[]
  onDone: () => void
  onCancel: () => void
  onCreated?: (v: { id: number | string; title: string }) => void
}) {
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  // Своё видео обязано быть платным — по умолчанию самый дешёвый уровень.
  const [minTierId, setMinTierId] = useState<string>(() => (tiers[0] ? String(tiers[0].id) : ''))
  const [categoryId, setCategoryId] = useState('')
  const [season, setSeason] = useState('')
  const [episode, setEpisode] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    setError(null)
    if (!title.trim()) return setError('Укажите название')
    if (!url.trim()) return setError('Укажите ссылку на видеофайл')
    if (!minTierId) return setError('Выберите уровень доступа — своё видео доступно только по подписке')
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
          isPreview: false,
          categoryId: categoryId || null,
          season: season.trim() || null,
          episode: episode.trim() || null,
          tags,
        }),
      })
      const json = await res.json()
      if (!res.ok) setError(json.error || 'Не удалось добавить видео')
      else {
        if (json.id != null) onCreated?.({ id: json.id, title: title.trim() })
        onDone()
      }
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
          ? 'Ссылка на видео: Яндекс.Диск (публичная), Object Storage, S3, YouTube. Хранилище скачает и подготовит само.'
          : 'Ссылка на видео из вашего хранилища: Яндекс.Диск (публичная ссылка), Яндекс Object Storage, R2 или S3. Хранилище скачает и подготовит само.'}
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
              { value: '', label: tiers.length ? '— выберите уровень —' : 'Сначала создайте уровень подписки' },
              ...tiers.map((t) => ({ value: String(t.id), label: `${t.name} и выше` })),
            ]}
            ariaLabel="Уровень доступа"
          />
          <div className="studio-field__hint" style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
            Своё видео доступно только по подписке.
          </div>
        </label>
      </div>
      <VideoMetaFields
        categories={categories}
        categoryId={categoryId} setCategoryId={setCategoryId}
        season={season} setSeason={setSeason}
        episode={episode} setEpisode={setEpisode}
        tags={tags} setTags={setTags}
      />
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

/* ============================================================================
   ВИДЕО ПО ВНЕШНЕЙ ССЫЛКЕ (VK Видео, VK Клипы, Дзен)
   ============================================================================
   Ничего никуда не заливается: файл остаётся на площадке. Автор вставляет
   ссылку ИЛИ готовый код <iframe>, сервер разбирает, проверяет хост по белому
   списку и сохраняет нормализованный адрес — сырой HTML не хранится.

   Про уровень доступа предупреждаем ЗАРАНЕЕ, а не после сохранения: закрыть
   внешнюю вставку подпиской технически невозможно, и автор должен понимать это
   до того, как выложит платный материал.
*/
/* ============================================================================
   ЗАГРУЗКА В СВОЁ ХРАНИЛИЩЕ (provider='self')
   presigned PUT оригинала в S3 → create-from-storage (ставит задачу транскода).
   Своё видео обязательно платное — уровень доступа требуется.
   ============================================================================ */
function SelfUploadForm({
  tiers,
  categories,
  onDone,
  onCancel,
  onCreated,
}: {
  tiers: Tier[]
  categories: MetaCat[]
  onDone: () => void
  onCancel: () => void
  onCreated?: (v: { id: number | string; title: string }) => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [minTierId, setMinTierId] = useState<string>(() => (tiers[0] ? String(tiers[0].id) : ''))
  const [categoryId, setCategoryId] = useState('')
  const [season, setSeason] = useState('')
  const [episode, setEpisode] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [pct, setPct] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<'file' | 'url'>('file')
  const [url, setUrl] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)

  function putWithProgress(url: string, f: File, contentType: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('PUT', url)
      xhr.setRequestHeader('Content-Type', contentType)
      xhr.upload.onprogress = (e) => { if (e.lengthComputable) setPct(Math.round((e.loaded / e.total) * 100)) }
      xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Загрузка не удалась (HTTP ${xhr.status})`)))
      xhr.onerror = () => reject(new Error('Ошибка сети при загрузке'))
      xhr.send(f)
    })
  }

  async function importUrl() {
    setError(null)
    if (!url.trim()) return setError('Вставьте ссылку на Яндекс.Диск')
    if (!title.trim()) return setError('Укажите название')
    if (!minTierId) return setError('Выберите уровень доступа — своё видео доступно только по подписке')
    setUploading(true)
    try {
      const res = await fetch('/studio/api/videos/import-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          url: url.trim(),
          title: title.trim(),
          minTierId,
          categoryId: categoryId || null,
          season: season.trim() || null,
          episode: episode.trim() || null,
          tags,
        }),
      })
      const j = await res.json()
      if (!res.ok) { setError(j.error || 'Не удалось импортировать'); setUploading(false); return }
      if (j.id != null) onCreated?.({ id: j.id, title: title.trim() })
      onDone()
    } catch {
      setError('Ошибка соединения')
      setUploading(false)
    }
  }

  async function start() {
    setError(null)
    if (!file) return setError('Выберите файл')
    if (!title.trim()) return setError('Укажите название')
    if (!minTierId) return setError('Выберите уровень доступа — своё видео доступно только по подписке')
    const contentType = file.type || 'video/mp4'
    setUploading(true)
    setPct(0)
    try {
      const presRes = await fetch('/studio/api/videos/asset-presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ filename: file.name, contentType, size: file.size }),
      })
      const pres = await presRes.json()
      if (!presRes.ok) { setError(pres.error || 'Не удалось начать загрузку'); setUploading(false); return }

      await putWithProgress(pres.uploadUrl, file, contentType)

      const createRes = await fetch('/studio/api/videos/create-from-storage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          key: pres.key,
          title: title.trim(),
          minTierId,
          categoryId: categoryId || null,
          season: season.trim() || null,
          episode: episode.trim() || null,
          tags,
        }),
      })
      const created = await createRes.json()
      if (!createRes.ok) { setError(created.error || 'Файл залит, но запись не создана'); setUploading(false); return }
      if (created.id != null) onCreated?.({ id: created.id, title: title.trim() })
      onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки')
      setUploading(false)
    }
  }

  return (
    <>
      <div className="vid__tabs">
        <button type="button" className={`vid__tab${mode === 'file' ? ' is-active' : ''}`} onClick={() => setMode('file')} disabled={uploading}>
          <Upload size={15} /> С устройства
        </button>
        <button type="button" className={`vid__tab${mode === 'url' ? ' is-active' : ''}`} onClick={() => setMode('url')} disabled={uploading}>
          <LinkIcon size={15} /> Со ссылки (Яндекс.Диск)
        </button>
      </div>

      <div className="studio-notice studio-notice--warn">
        <Lock size={16} />
        <span>
          <b>Только по подписке.</b> Своё видео нельзя выложить бесплатно для всех —
          оно занимает наше хранилище и обработку. Мы соберём HLS с несколькими
          качествами (подстраивается под зрителя, работает в РФ без VPN).{' '}
          {mode === 'url'
            ? 'Файл заберём с Яндекс.Диска напрямую, без скачивания на ваше устройство.'
            : 'После загрузки видео обрабатывается — чем больше и длиннее файл, тем дольше. Это нормально: можно продолжать работу, статус обновится сам.'}
        </span>
      </div>

      {mode === 'url' ? (
        <label className="studio-field">
          <span className="studio-field__label">Ссылка на Яндекс.Диск</span>
          <input
            className="studio-input"
            placeholder="https://disk.yandex.ru/i/…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={uploading}
            autoFocus
          />
        </label>
      ) : (
      <div className="studio-field">
        <span className="studio-field__label">Видеофайл</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            type="button"
            className="studio-btn studio-btn--ghost"
            onClick={() => fileInput.current?.click()}
            disabled={uploading}
          >
            <Upload size={16} /> Выбрать файл
          </button>
          <span style={{ fontSize: 13, color: 'var(--st-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {file ? file.name : 'Файл не выбран'}
          </span>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept="video/*"
          disabled={uploading}
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0] || null
            setFile(f)
            if (f && !title.trim()) setTitle(f.name.replace(/\.[^.]+$/, ''))
          }}
        />
      </div>
      )}

      <label className="studio-field">
        <span className="studio-field__label">Название</span>
        <input className="studio-input" value={title} onChange={(e) => setTitle(e.target.value)} disabled={uploading} />
      </label>

      <div className="vid__form-row">
        <label className="studio-field" style={{ flex: 1 }}>
          <span className="studio-field__label">Уровень доступа</span>
          <StudioSelect
            value={minTierId}
            onChange={setMinTierId}
            options={[
              { value: '', label: tiers.length ? '— выберите уровень —' : 'Сначала создайте уровень подписки' },
              ...tiers.map((t) => ({ value: String(t.id), label: `${t.name} и выше` })),
            ]}
            disabled={uploading}
            ariaLabel="Уровень доступа"
          />
          <div className="studio-field__hint" style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
            Своё видео доступно только по подписке — оно занимает наше хранилище и обработку.
          </div>
        </label>
      </div>

      <VideoMetaFields
        categories={categories}
        categoryId={categoryId} setCategoryId={setCategoryId}
        season={season} setSeason={setSeason}
        episode={episode} setEpisode={setEpisode}
        tags={tags} setTags={setTags}
      />

      {uploading && (
        <div className="vid__form-hint">
          Загрузка: {pct}% {pct >= 100 ? '· создаём запись…' : ''}
        </div>
      )}
      {error && <div className="studio-login__error">{error}</div>}

      <div className="vid__form-actions">
        <button className="studio-btn studio-btn--ghost" onClick={onCancel} disabled={uploading}>Отмена</button>
        <button
          className="studio-btn studio-btn--primary"
          onClick={mode === 'url' ? importUrl : start}
          disabled={uploading || (mode === 'file' ? !file : !url.trim())}
        >
          {uploading ? <Loader2 size={16} className="spin" /> : mode === 'url' ? <LinkIcon size={16} /> : <Upload size={16} />}
          {uploading ? (mode === 'url' ? 'Импорт…' : 'Загрузка…') : mode === 'url' ? 'Импортировать' : 'Загрузить'}
        </button>
      </div>
    </>
  )
}

function EmbedFields({
  categories,
  onDone,
  onCancel,
  onCreated,
}: {
  // tiers больше не нужен: внешняя вставка всегда бесплатна. Оставляем в типе
  // для совместимости с вызовом <EmbedFields tiers=… />.
  tiers?: Tier[]
  categories: MetaCat[]
  onDone: () => void
  onCancel: () => void
  onCreated?: (v: { id: number | string; title: string }) => void
}) {
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [season, setSeason] = useState('')
  const [episode, setEpisode] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    setError(null)
    if (!url.trim()) return setError('Вставьте ссылку или код вставки')
    setBusy(true)
    try {
      const res = await fetch('/studio/api/videos/embed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: title.trim(),
          url: url.trim(),
          // Внешняя вставка всегда бесплатна для всех — сервер это форсит
          // (хук enforceAccessPolicy), здесь передаём явно для ясности.
          minTierId: null,
          isPreview: true,
          categoryId: categoryId || null,
          season: season.trim() || null,
          episode: episode.trim() || null,
          tags,
        }),
      })
      const json = await res.json()
      if (!res.ok) setError(json.error || 'Не удалось добавить видео')
      else {
        if (json.id != null) onCreated?.({ id: json.id, title: title.trim() || (json.providerLabel ? `Видео · ${json.providerLabel}` : 'Видео') })
        onDone()
      }
    } catch {
      setError('Ошибка соединения')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <p className="vid__form-hint">
        Вставьте ссылку на видео или код из кнопки «Поделиться → Встроить».
        Поддерживаются VK Видео, VK Клипы и Дзен. Для закрытого видео на VK
        нужен именно код вставки — в обычной ссылке нет ключа доступа.
      </p>
      <label className="studio-field">
        <span className="studio-field__label">Название</span>
        <input
          className="studio-input"
          placeholder="Можно оставить пустым — подставим по площадке"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </label>
      <label className="studio-field">
        <span className="studio-field__label">Ссылка или код вставки</span>
        <textarea
          className="studio-input"
          rows={3}
          placeholder={'https://vkvideo.ru/video-217576166_456247784\nили <iframe src="https://vk.ru/video_ext.php?oid=...&id=...&hash=..."></iframe>'}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          autoFocus
        />
      </label>
      <div className="vid__form-hint" style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <Unlock size={15} style={{ flexShrink: 0, marginTop: 1, opacity: 0.8 }} />
        <span>
          <b>Доступно всем бесплатно.</b> Внешнее видео нельзя закрыть подпиской:
          плеер грузится с чужого домена (VK, Дзен), и адрес виден в исходнике
          страницы. Чтобы продавать доступ — загрузите видео в наше хранилище.
        </span>
      </div>

      <VideoMetaFields
        categories={categories}
        categoryId={categoryId} setCategoryId={setCategoryId}
        season={season} setSeason={setSeason}
        episode={episode} setEpisode={setEpisode}
        tags={tags} setTags={setTags}
      />

      <div className="vid__form-hint" style={{ color: 'var(--st-warning)', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
        <span>
          Видео остаётся на стороннем сервисе — мы его не копируем к себе, а
          только показываем на сайте. Если автор удалит или закроет его на VK
          (Дзене), у вас оно тоже перестанет отображаться. Закрытое VK-видео
          («только для подписчиков VK») во вставке не сработает — такое нужно
          загрузить в наше хранилище.
        </span>
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
