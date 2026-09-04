'use client'

import React, { useState, useRef, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { X, ImagePlus, Loader2, Check, Trash2, GripVertical, FolderOpen, FileText, Video as VideoIcon, Headphones, ArrowUpRight } from 'lucide-react'
import { TiptapEditor } from '../posts/new/TiptapEditor'
import { slugify } from '@/lib/slugify'
import { StudioSelect } from '../_ui/StudioSelect'

export type EditableCat = {
  id: number | string
  title: string
  slug: string
  descriptionHtml: string
  coverId: number | null
  coverUrl: string | null
  posterLayout: boolean
  pageMode?: boolean
  videoSeries: boolean
  eventTemplate: boolean
  hideDate?: boolean
}

/** Ответ роута загрузки обложки /studio/api/categories/cover. */
type CoverResponse = { error?: string; id?: number; url?: string | null }

/** Элемент списка «Порядок содержимого»: подкатегория (c) или публикация (p). */
type ContentItem = { k: 'c' | 'p'; id: number; title: string; coverUrl: string | null }

/**
 * Выдвижная панель редактирования категории. Название, slug (авто-превью),
 * описание (редактор → HTML → Lexical на сервере), обложка (R2).
 * Сохранение одним запросом на /studio/api/categories/update.
 */
export function CategoryEditPanel({
  cat,
  onClose,
  onSaved,
}: {
  cat: EditableCat
  onClose: () => void
  onSaved: () => void
}) {
  const [title, setTitle] = useState(cat.title)
  const [slug, setSlug] = useState(cat.slug || '')
  const [descHtml, setDescHtml] = useState(cat.descriptionHtml || '')
  const [coverId, setCoverId] = useState<number | null>(cat.coverId)
  const [coverUrl, setCoverUrl] = useState<string | null>(cat.coverUrl)
  const [posterLayout, setPosterLayout] = useState<boolean>(cat.posterLayout ?? false)
  const [pageMode, setPageMode] = useState<boolean>(cat.pageMode ?? false)
  const [videoSeries, setVideoSeries] = useState<boolean>(cat.videoSeries ?? false)
  const [eventTemplate, setEventTemplate] = useState<boolean>(cat.eventTemplate ?? false)
  const [hideDate, setHideDate] = useState<boolean>(cat.hideDate ?? false)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const [allCats, setAllCats] = useState<{ id: number; title: string; parentId: number | null }[]>([])
  const [parentSel, setParentSel] = useState<string>('__root__')

  // Порядок содержимого (подкатегории + публикации) для drag-and-drop.
  const [content, setContent] = useState<ContentItem[]>([])
  const [contentLoaded, setContentLoaded] = useState(false)
  const [contentLoading, setContentLoading] = useState(false)
  // Видео/аудио, привязанные к разделу (только для показа + перехода).
  const [catVideos, setCatVideos] = useState<{ id: number; title: string; slug: string; provider: string; episode: number | null }[]>([])
  const dragIndex = useRef<number | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)

  // Ручная сортировка доступна для типов со списком (обычный, контейнер афиш,
  // события). У плейлиста порядок задаётся сезоном/эпизодом, у «страницы» списка нет.
  const showOrder = !videoSeries && !pageMode

  const slugPreview = slugify(title)

  // Содержимое раздела для редактора порядка — грузим один раз при открытии
  // (список не зависит от выбранного типа, только от самого раздела).
  useEffect(() => {
    let stop = false
    setContentLoading(true)
    fetch(`/studio/api/categories/content?id=${encodeURIComponent(String(cat.id))}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((j) => {
        if (stop) return
        setContent(Array.isArray(j.items) ? (j.items as ContentItem[]) : [])
        setCatVideos(Array.isArray(j.videos) ? j.videos : [])
        setContentLoaded(true)
      })
      .catch(() => {
        if (!stop) setContentLoaded(true)
      })
      .finally(() => {
        if (!stop) setContentLoading(false)
      })
    return () => {
      stop = true
    }
  }, [cat.id])

  function reorderContent(from: number, to: number) {
    setContent((prev) => {
      if (from === to || from < 0 || to < 0 || from >= prev.length || to >= prev.length) return prev
      const next = prev.slice()
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
  }

  // Список категорий тенанта — для выбора родителя. Текущий родитель ставим в селект.
  useEffect(() => {
    let stop = false
    fetch('/studio/api/settings/categories-list', { credentials: 'include' })
      .then((r) => r.json())
      .then((j) => {
        if (stop) return
        const list = (Array.isArray(j.categories) ? j.categories : []).map((c: any) => ({
          id: Number(c.id),
          title: String(c.title || ''),
          parentId: c.parentId == null ? null : Number(c.parentId),
        }))
        setAllCats(list)
        const self = list.find((c: any) => c.id === Number(cat.id))
        setParentSel(self && self.parentId != null ? String(self.parentId) : '__root__')
      })
      .catch(() => {})
    return () => {
      stop = true
    }
  }, [cat.id])

  // Родителем нельзя сделать саму категорию или её потомка (иначе цикл).
  const parentOptions = useMemo(() => {
    const childrenBy = new Map<number | null, number[]>()
    for (const c of allCats) {
      const arr = childrenBy.get(c.parentId) ?? []
      arr.push(c.id)
      childrenBy.set(c.parentId, arr)
    }
    const banned = new Set<number>([Number(cat.id)])
    const stack = [Number(cat.id)]
    while (stack.length) {
      const id = stack.pop() as number
      for (const ch of childrenBy.get(id) ?? []) {
        if (!banned.has(ch)) {
          banned.add(ch)
          stack.push(ch)
        }
      }
    }
    const opts: { value: string; label: string }[] = [
      { value: '__root__', label: 'Верхний уровень' },
    ]
    for (const c of allCats) if (!banned.has(c.id)) opts.push({ value: String(c.id), label: c.title })
    return opts
  }, [allCats, cat.id])

  async function handleCover(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)

      // 1) Сеть/запрос: если fetch упал — это не ответ сервера, а обрыв связи.
      let res: Response
      try {
        res = await fetch('/studio/api/categories/cover', {
          method: 'POST',
          body: fd,
          credentials: 'include',
        })
      } catch {
        setError('Не удалось связаться с сервером (нет сети или запрос прерван). Проверьте соединение и повторите.')
        return
      }

      // 2) Тело ответа: пытаемся как JSON, иначе как текст (сервер мог отдать
      //    HTML-страницу ошибки платформы — тогда res.json() бросил бы исключение).
      const contentType = res.headers.get('content-type') || ''
      let data: CoverResponse | null = null
      let rawText = ''
      if (contentType.includes('application/json')) {
        data = (await res.json().catch(() => null)) as CoverResponse | null
      } else {
        rawText = (await res.text().catch(() => '')).trim()
      }

      // 3) Ошибка: показываем максимально конкретную причину.
      if (!res.ok) {
        let msg = data?.error
        if (!msg) {
          if (res.status === 401) {
            msg = 'Сессия истекла — войдите в студию заново и повторите загрузку.'
          } else if (res.status === 413) {
            msg = 'Файл слишком большой — сервер отклонил загрузку. Возьмите картинку меньшего веса.'
          } else if (res.status === 502 || res.status === 503 || res.status === 500) {
            msg = `Сервер не смог обработать изображение (HTTP ${res.status}) — вероятно, не хватило памяти при создании превью. Попробуйте изображение меньшего размера/веса (например, ≤ 2 МБ, до ~2000px по ширине).`
          } else {
            msg = `Ошибка сервера (HTTP ${res.status}).`
          }
          if (rawText) msg += ` Ответ сервера: ${rawText.slice(0, 200)}`
        }
        setError(msg)
        return
      }

      // 4) Успех, но без данных — тоже сигнализируем явно.
      if (!data?.id) {
        setError('Сервер вернул неожиданный ответ без данных обложки. Повторите попытку.')
        return
      }

      setCoverId(data.id)
      setCoverUrl(data.url ?? null)
    } finally {
      setUploading(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  function removeCover() {
    setCoverId(null)
    setCoverUrl(null)
  }

  async function save() {
    setError(null)
    if (!title.trim()) {
      setError('Название не может быть пустым')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/studio/api/categories/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          id: cat.id,
          title: title.trim(),
          slug: slug.trim() || undefined,
          description: descHtml,
          coverId: coverId ?? null,
          posterLayout,
          pageMode,
          videoSeries,
          eventTemplate,
          hideDate,
          parentId: parentSel === '__root__' ? null : Number(parentSel),
          // Порядок отправляем только когда он релевантен типу и уже загружен —
          // иначе быстрый «Сохранить» до загрузки затёр бы его пустым массивом.
          ...(showOrder && contentLoaded
            ? { contentOrder: content.map((i) => ({ k: i.k, id: i.id })) }
            : {}),
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || 'Не удалось сохранить')
        setSaving(false)
        return
      }
      onSaved()
    } catch {
      setError('Ошибка соединения')
      setSaving(false)
    }
  }

  return (
    <div className="catedit__overlay" onClick={onClose}>
      <div className="catedit" onClick={(e) => e.stopPropagation()}>
        <div className="catedit__head">
          <h3>Редактирование категории</h3>
          <button className="catmgr__icon-btn" onClick={onClose} title="Закрыть">
            <X size={18} />
          </button>
        </div>

        <div className="catedit__body">
          <div className="studio-field">
            <span className="studio-field__label">Название</span>
            <input
              className="studio-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>

          <div className="studio-field">
            <span className="studio-field__label">Адрес (slug)</span>
            <input
              className="studio-input"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder={slugPreview || 'напр. american-hustle-life'}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4, flexWrap: 'wrap' }}>
              <span className="catedit__slug">/{slugify(slug) || slugPreview || '…'}</span>
              {slugify(title) && slugify(slug) !== slugify(title) && (
                <button
                  type="button"
                  onClick={() => setSlug(slugify(title))}
                  style={{ background: 'none', border: 'none', color: 'var(--brand-primary, #e86a33)', fontSize: 12, cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                >
                  из названия
                </button>
              )}
            </div>
            <div className="studio-field__hint" style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
              Меняет ссылку раздела. Старый адрес перестанет работать — используйте латиницу и дефисы.
            </div>
          </div>

          <div className="studio-field">
            <span className="studio-field__label">Родительская категория</span>
            <StudioSelect
              value={parentSel}
              onChange={setParentSel}
              options={parentOptions}
              ariaLabel="Родительская категория"
            />
            <div className="catedit__hint">
              Перемещает категорию в дереве — она переедет под выбранную категорию везде (меню, хлебные крошки). «Верхний уровень» — сделать корневой.
            </div>
          </div>

          <div className="studio-field">
            <span className="studio-field__label">Тип раздела</span>
            <div className="catedit__poster-toggle">
              <button
                type="button"
                className={`catedit__poster-opt${!posterLayout && !pageMode ? ' is-on' : ''}`}
                onClick={() => { setPosterLayout(false); setPageMode(false) }}
              >
                Обычный раздел
              </button>
              <button
                type="button"
                className={`catedit__poster-opt${posterLayout ? ' is-on' : ''}`}
                onClick={() => { setPosterLayout(true); setVideoSeries(false); setPageMode(false) }}
              >
                Контейнер афиш
              </button>
              <button
                type="button"
                className={`catedit__poster-opt${pageMode ? ' is-on' : ''}`}
                onClick={() => { setPageMode(true); setPosterLayout(false); setVideoSeries(false) }}
              >
                Страница
              </button>
            </div>
            <div className="catedit__hint">
              {pageMode
                ? 'Страница — раздел показывает ОДНУ публикацию, привязанную к нему основной категорией (например, профиль участника). Список вложенных публикаций не выводится. Берётся последняя опубликованная публикация этой категории.'
                : posterLayout
                ? 'Контейнер афиш — дочерние категории этого раздела выводятся вертикальными постерами 2:3 (афишами): рядом на главной и сеткой на странице раздела. Клик по афише ведёт в дочерний раздел с эпизодами. Вертикальную обложку загружайте в КАЖДУЮ дочернюю категорию.'
                : 'Обычный раздел — видео, публикации и подразделы. Ниже выберите, как показывать видео этого раздела.'}
            </div>
          </div>

          {!posterLayout && !pageMode && (
            <div className="studio-field">
              <span className="studio-field__label">Видео в разделе</span>
              <div className="catedit__poster-toggle">
                <button
                  type="button"
                  className={`catedit__poster-opt${!videoSeries ? ' is-on' : ''}`}
                  onClick={() => setVideoSeries(false)}
                >
                  Одиночные
                </button>
                <button
                  type="button"
                  className={`catedit__poster-opt${videoSeries ? ' is-on' : ''}`}
                  onClick={() => setVideoSeries(true)}
                >
                  Плейлист
                </button>
              </div>
              <div className="catedit__hint">
                {videoSeries
                  ? 'Плейлист — плеер со списком серий по сезонам (YouTube-подобно). Номер сезона и порядок эпизода задаются у каждого видео этого раздела.'
                  : 'Одиночные — видео раздела выводятся горизонтальными карточками 16:9 (одно видео — крупнее). Публикации показываются как обычно.'}
              </div>
            </div>
          )}

          <div className="studio-field">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={eventTemplate} onChange={(e) => setEventTemplate(e.target.checked)} />
              <span className="studio-field__label" style={{ margin: 0 }}>Раздел-события</span>
            </label>
            <div className="catedit__hint">Публикации получают «Дату события»; список сортируется по ней (новые сверху), а на обложке и в публикации показывается оранжевая плашка с датой.</div>
          </div>

          <div className="studio-field">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={hideDate} onChange={(e) => setHideDate(e.target.checked)} />
              <span className="studio-field__label" style={{ margin: 0 }}>Не показывать дату</span>
            </label>
            <div className="catedit__hint">Скрывает дату публикации на странице и в карточках этого раздела (в т.ч. плашку «N дней назад»). Для вечнозелёного контента — профилей, фильмов, справочных материалов, где дата не важна.</div>
          </div>

          <div className="studio-field">
            <span className="studio-field__label">Обложка</span>
            {coverUrl ? (
              <div className="catedit__cover">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={coverUrl} alt="Обложка категории" />
                <button className="catedit__cover-remove" onClick={removeCover} title="Убрать">
                  <Trash2 size={15} />
                </button>
              </div>
            ) : (
              <button
                className="composer__cover-add"
                onClick={() => fileInput.current?.click()}
                disabled={uploading}
                style={{ marginBottom: 0 }}
              >
                {uploading ? <Loader2 size={18} className="spin" /> : <ImagePlus size={18} />}
                {uploading ? 'Загрузка…' : 'Загрузить обложку'}
              </button>
            )}
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              onChange={handleCover}
              style={{ display: 'none' }}
            />
          </div>

          {showOrder && (
            <div className="studio-field">
              <span className="studio-field__label">Порядок содержимого</span>
              <div className="catedit__hint">
                Перетащите элементы, чтобы задать порядок вывода на сайте. В список входят подкатегории и публикации этого раздела; публикации и разделы идут единой лентой. Новые элементы появляются в конце. Порядок применится после сохранения.
              </div>
              {contentLoading ? (
                <div className="catorder__note">
                  <Loader2 size={15} className="spin" /> Загрузка…
                </div>
              ) : content.length === 0 ? (
                <div className="catorder__note">В разделе пока нет подкатегорий и публикаций.</div>
              ) : (
                <ul className="catorder">
                  {content.map((it, i) => (
                    <li
                      key={`${it.k}-${it.id}`}
                      className={`catorder__row${dragOver === i ? ' is-over' : ''}`}
                      draggable
                      onDragStart={() => {
                        dragIndex.current = i
                      }}
                      onDragOver={(e) => {
                        e.preventDefault()
                        if (dragIndex.current !== null && dragIndex.current !== i) {
                          reorderContent(dragIndex.current, i)
                          dragIndex.current = i
                        }
                        setDragOver(i)
                      }}
                      onDragEnd={() => {
                        dragIndex.current = null
                        setDragOver(null)
                      }}
                      onDrop={(e) => {
                        e.preventDefault()
                        dragIndex.current = null
                        setDragOver(null)
                      }}
                    >
                      <span className="catorder__grip" aria-hidden>
                        <GripVertical size={16} />
                      </span>
                      {it.coverUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={it.coverUrl} alt="" className="catorder__thumb" />
                      ) : (
                        <span className="catorder__thumb catorder__thumb--empty" aria-hidden>
                          {it.k === 'c' ? <FolderOpen size={13} /> : <FileText size={13} />}
                        </span>
                      )}
                      <span className="catorder__title">{it.title}</span>
                      <span className={`catorder__tag catorder__tag--${it.k}`}>
                        {it.k === 'c' ? 'Раздел' : 'Публикация'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {catVideos.length > 0 && (
            <div className="studio-field">
              <span className="studio-field__label">Видео в разделе ({catVideos.length})</span>
              <ul style={{ listStyle: 'none', margin: '4px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {catVideos.map((v) => (
                  <li key={v.id}>
                    <Link
                      href={`/studio/videos/${v.id}`}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--st-border, rgba(0,0,0,.1))', color: 'var(--st-text)', textDecoration: 'none', fontSize: 14 }}
                    >
                      {v.provider === 'audio' ? <Headphones size={15} style={{ flex: 'none', color: 'var(--st-text-muted)' }} /> : <VideoIcon size={15} style={{ flex: 'none', color: 'var(--st-text-muted)' }} />}
                      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.title}</span>
                      {v.episode != null && <span style={{ fontSize: 12, color: 'var(--st-text-muted)' }}>Серия {v.episode}</span>}
                      <ArrowUpRight size={14} style={{ flex: 'none', color: 'var(--st-text-muted)' }} />
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="studio-field__hint" style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
                Видео и аудио, привязанные к этому разделу. Клик — открыть на редактирование.
              </div>
            </div>
          )}

          <div className="studio-field">
            <span className="studio-field__label">Описание</span>
            <TiptapEditor
              initialHtml={cat.descriptionHtml || ''}
              onChange={setDescHtml}
              placeholder="Описание категории — показывается на странице раздела."
            />
          </div>

          {error && <div className="studio-login__error">{error}</div>}
        </div>

        <div className="catedit__foot">
          <button className="studio-btn studio-btn--ghost" onClick={onClose}>
            Отмена
          </button>
          <button className="studio-btn studio-btn--primary" onClick={save} disabled={saving || uploading}>
            {saving ? <Loader2 size={16} className="spin" /> : <Check size={16} />}
            Сохранить
          </button>
        </div>
      </div>
    </div>
  )
}
