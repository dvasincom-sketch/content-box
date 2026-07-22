'use client'

import React, { useState, useRef } from 'react'
import { X, ImagePlus, Loader2, Check, Trash2 } from 'lucide-react'
import { RichEditor } from '../posts/new/RichEditor'
import { slugify } from '@/lib/slugify'

export type EditableCat = {
  id: number | string
  title: string
  slug: string
  descriptionHtml: string
  coverId: number | null
  coverUrl: string | null
  posterLayout: boolean
}

/** Ответ роута загрузки обложки /studio/api/categories/cover. */
type CoverResponse = { error?: string; id?: number; url?: string | null }

/**
 * Выдвижная панель редактирования категории. Название, slug (авто-превью),
 * описание (RichEditor → HTML → Lexical на сервере), обложка (R2).
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
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const slugPreview = slugify(title)

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
            <span className="studio-field__label">Тип раздела</span>
            <div className="catedit__poster-toggle">
              <button
                type="button"
                className={`catedit__poster-opt${!posterLayout ? ' is-on' : ''}`}
                onClick={() => setPosterLayout(false)}
              >
                Обычный раздел
              </button>
              <button
                type="button"
                className={`catedit__poster-opt${posterLayout ? ' is-on' : ''}`}
                onClick={() => setPosterLayout(true)}
              >
                Контейнер афиш
              </button>
            </div>
            <div className="catedit__hint">
              Контейнер афиш — дочерние категории этого раздела выводятся вертикальными постерами 2:3 (афишами): рядом на главной и сеткой на странице раздела. Клик по афише ведёт в дочерний раздел с эпизодами. Вертикальную обложку загружайте в КАЖДУЮ дочернюю категорию.
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
            <RichEditor
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
