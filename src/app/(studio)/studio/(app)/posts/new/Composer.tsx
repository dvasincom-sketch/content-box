'use client'

import React, { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ImagePlus, X, Loader2, Trash2 } from 'lucide-react'
import { slugify } from '@/lib/slugify'
import { CategoryPicker, type CatItem } from './CategoryPicker'
import { RichEditor } from './RichEditor'

type Category = CatItem
type Tier = { id: number | string; name: string; weight: number; priceRub: number }

export type PostInitial = {
  id: number | string
  title: string
  body: string
  slug: string
  categoryId: string
  minTierId: string
  coverId: number | null
  coverUrl: string | null
  isPublished: boolean
}

export function Composer({
  categories,
  tiers,
  initial,
}: {
  categories: Category[]
  tiers: Tier[]
  initial?: PostInitial
}) {
  const router = useRouter()
  const isEdit = !!initial

  const [title, setTitle] = useState(initial?.title || '')
  const [body, setBody] = useState(initial?.body || '')
  const [categoryId, setCategoryId] = useState<string>(initial?.categoryId || '')
  const [minTierId, setMinTierId] = useState<string>(initial?.minTierId || '')

  const [coverId, setCoverId] = useState<number | null>(initial?.coverId ?? null)
  const [coverUrl, setCoverUrl] = useState<string | null>(initial?.coverUrl ?? null)
  const [uploading, setUploading] = useState(false)

  const [saving, setSaving] = useState<false | 'draft' | 'publish' | 'save' | 'unpublish'>(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  // В edit slug фиксирован (может быть в ссылках); в create — превью из заголовка.
  const slugText = isEdit ? initial!.slug : slugify(title)

  async function handleCover(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/studio/api/upload-cover', {
        method: 'POST',
        body: fd,
        credentials: 'include',
      })
      const json = await res.json()
      if (!res.ok) setError(json.error || 'Не удалось загрузить обложку')
      else {
        setCoverId(json.id)
        setCoverUrl(json.url)
      }
    } catch {
      setError('Ошибка загрузки обложки')
    } finally {
      setUploading(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  function removeCover() {
    setCoverId(null)
    setCoverUrl(null)
  }

  // publish: true → опубликовать/сохранить как опубл.; false → черновик/снять
  async function persist(kind: 'draft' | 'publish' | 'save' | 'unpublish') {
    setError(null)
    if (!title.trim()) {
      setError('Укажите заголовок')
      return
    }
    setSaving(kind)

    // publish-флаг для роутов
    let publish: boolean | undefined
    if (kind === 'publish') publish = true
    else if (kind === 'draft') publish = false
    else if (kind === 'unpublish') publish = false
    else if (kind === 'save') publish = undefined // сохранить, статус не менять

    const endpoint = isEdit ? '/studio/api/update-post' : '/studio/api/create-post'
    const payload: any = {
      title: title.trim(),
      body,
      // в edit шлём явные значения (null очищает); в create — undefined опускает
      categoryId: isEdit ? (categoryId || null) : (categoryId || undefined),
      minTierId: isEdit ? (minTierId || null) : (minTierId || undefined),
      coverId: isEdit ? (coverId ?? null) : (coverId || undefined),
    }
    if (isEdit) payload.id = initial!.id
    if (publish !== undefined) payload.publish = publish

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || 'Не удалось сохранить')
        setSaving(false)
        return
      }
      router.push('/studio/posts')
      router.refresh()
    } catch {
      setError('Ошибка соединения')
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!isEdit) return
    const ok = window.confirm(`Удалить публикацию «${title || 'без заголовка'}»? Это действие необратимо.`)
    if (!ok) return
    setError(null)
    setDeleting(true)
    try {
      const res = await fetch('/studio/api/delete-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id: initial!.id }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || 'Не удалось удалить')
        setDeleting(false)
        return
      }
      router.push('/studio/posts')
      router.refresh()
    } catch {
      setError('Ошибка соединения')
      setDeleting(false)
    }
  }

  const busy = saving !== false || deleting

  return (
    <div className="composer">
      <div className="composer__head">
        <Link href="/studio/posts" className="studio-back">
          <ArrowLeft size={16} />
          К публикациям
        </Link>
        <div className="composer__actions">
          {isEdit ? (
            <>
              <button
                className="studio-btn studio-btn--ghost composer__delete"
                onClick={handleDelete}
                disabled={busy}
                title="Удалить публикацию"
              >
                {deleting ? <Loader2 size={16} className="spin" /> : <Trash2 size={16} />}
                Удалить
              </button>
              {initial!.isPublished ? (
                <>
                  <button
                    className="studio-btn studio-btn--ghost"
                    onClick={() => persist('unpublish')}
                    disabled={busy}
                  >
                    {saving === 'unpublish' ? <Loader2 size={16} className="spin" /> : null}
                    Снять с публикации
                  </button>
                  <button
                    className="studio-btn studio-btn--primary"
                    onClick={() => persist('save')}
                    disabled={busy}
                  >
                    {saving === 'save' ? <Loader2 size={16} className="spin" /> : null}
                    Сохранить
                  </button>
                </>
              ) : (
                <>
                  <button
                    className="studio-btn studio-btn--ghost"
                    onClick={() => persist('save')}
                    disabled={busy}
                  >
                    {saving === 'save' ? <Loader2 size={16} className="spin" /> : null}
                    Сохранить черновик
                  </button>
                  <button
                    className="studio-btn studio-btn--primary"
                    onClick={() => persist('publish')}
                    disabled={busy}
                  >
                    {saving === 'publish' ? <Loader2 size={16} className="spin" /> : null}
                    Опубликовать
                  </button>
                </>
              )}
            </>
          ) : (
            <>
              <button
                className="studio-btn studio-btn--ghost"
                onClick={() => persist('draft')}
                disabled={busy}
              >
                {saving === 'draft' ? <Loader2 size={16} className="spin" /> : null}
                Черновик
              </button>
              <button
                className="studio-btn studio-btn--primary"
                onClick={() => persist('publish')}
                disabled={busy}
              >
                {saving === 'publish' ? <Loader2 size={16} className="spin" /> : null}
                Опубликовать
              </button>
            </>
          )}
        </div>
      </div>

      {error && <div className="studio-login__error composer__error">{error}</div>}

      <div className="composer__grid">
        <div className="composer__main">
          <input
            className="composer__title"
            placeholder="Заголовок публикации"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          {slugText && (
            <div className="composer__slug">
              /{slugText}
              {!isEdit && <span className="composer__slug-caret" aria-hidden />}
            </div>
          )}

          {coverUrl ? (
            <div className="composer__cover">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={coverUrl} alt="Обложка" />
              <button className="composer__cover-remove" onClick={removeCover} title="Убрать">
                <X size={16} />
              </button>
            </div>
          ) : (
            <button
              className="composer__cover-add"
              onClick={() => fileInput.current?.click()}
              disabled={uploading}
            >
              {uploading ? <Loader2 size={18} className="spin" /> : <ImagePlus size={18} />}
              {uploading ? 'Загрузка…' : 'Прикрепить обложку'}
            </button>
          )}
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            onChange={handleCover}
            style={{ display: 'none' }}
          />

          <RichEditor
            initialHtml={initial?.body || ''}
            onChange={setBody}
            placeholder="Текст публикации. Выделите текст и примените форматирование."
          />
        </div>

        <aside className="composer__side">
          <div className="composer__field">
            <div className="composer__field-label">Уровень доступа</div>
            <select
              className="studio-input"
              value={minTierId}
              onChange={(e) => setMinTierId(e.target.value)}
            >
              <option value="">Бесплатно — для всех</option>
              {tiers.map((t) => (
                <option key={t.id} value={String(t.id)}>
                  {t.name} · {t.priceRub}₽
                </option>
              ))}
            </select>
            <div className="composer__hint">
              Публикация будет доступна подписчикам этого уровня и выше.
            </div>
          </div>

          <div className="composer__field">
            <div className="composer__field-label">Категория</div>
            <CategoryPicker categories={categories} value={categoryId} onChange={setCategoryId} />
          </div>
        </aside>
      </div>
    </div>
  )
}
