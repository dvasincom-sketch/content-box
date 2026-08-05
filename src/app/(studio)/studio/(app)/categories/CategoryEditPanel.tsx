'use client'

import React, { useState, useRef, useEffect, useMemo } from 'react'
import { X, ImagePlus, Loader2, Check, Trash2 } from 'lucide-react'
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
  videoSeries: boolean
}

/** Ответ роута загрузки обложки /studio/api/categories/cover. */
type CoverResponse = { error?: string; id?: number; url?: string | null }

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
  const [descHtml, setDescHtml] = useState(cat.descriptionHtml || '')
  const [coverId, setCoverId] = useState<number | null>(cat.coverId)
  const [coverUrl, setCoverUrl] = useState<string | null>(cat.coverUrl)
  const [posterLayout, setPosterLayout] = useState<boolean>(cat.posterLayout ?? false)
  const [videoSeries, setVideoSeries] = useState<boolean>(cat.videoSeries ?? false)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const [allCats, setAllCats] = useState<{ id: number; title: string; parentId: number | null }[]>([])
  const [parentSel, setParentSel] = useState<string>('__root__')

  const slugPreview = slugify(title)

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
          description: descHtml,
          coverId: coverId ?? null,
          posterLayout,
          videoSeries,
          parentId: parentSel === '__root__' ? null : Number(parentSel),
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
            {slugPreview && <div className="catedit__slug">/{slugPreview}</div>}
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
                className={`catedit__poster-opt${!posterLayout && !videoSeries ? ' is-on' : ''}`}
                onClick={() => { setPosterLayout(false); setVideoSeries(false) }}
              >
                Обычный раздел
              </button>
              <button
                type="button"
                className={`catedit__poster-opt${posterLayout ? ' is-on' : ''}`}
                onClick={() => { setPosterLayout(true); setVideoSeries(false) }}
              >
                Контейнер афиш
              </button>
              <button
                type="button"
                className={`catedit__poster-opt${videoSeries ? ' is-on' : ''}`}
                onClick={() => { setVideoSeries(true); setPosterLayout(false) }}
              >
                Медиа-плейлист
              </button>
            </div>
            <div className="catedit__hint">
              {videoSeries
                ? 'Медиа-плейлист — раздел выводится как плеер со списком серий по сезонам (YouTube-подобно). Номер сезона и порядок эпизода задаются у каждого аудио/видео этой категории.'
                : posterLayout
                  ? 'Контейнер афиш — дочерние категории этого раздела выводятся вертикальными постерами 2:3 (афишами): рядом на главной и сеткой на странице раздела. Клик по афише ведёт в дочерний раздел с эпизодами. Вертикальную обложку загружайте в КАЖДУЮ дочернюю категорию.'
                  : 'Обычный раздел — публикации выводятся списком, а подразделы — плитками. Подходит для текстовых разделов.'}
            </div>
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
