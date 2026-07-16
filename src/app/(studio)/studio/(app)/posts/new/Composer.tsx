'use client'

import React, { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ImagePlus, X, Loader2 } from 'lucide-react'
import { slugify } from '@/lib/slugify'
import { CategoryPicker, type CatItem } from './CategoryPicker'

type Category = CatItem
type Tier = { id: number | string; name: string; weight: number; priceRub: number }

export function Composer({ categories, tiers }: { categories: Category[]; tiers: Tier[] }) {
  const router = useRouter()

  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [categoryId, setCategoryId] = useState<string>('')
  const [minTierId, setMinTierId] = useState<string>('') // '' = бесплатно

  const [coverId, setCoverId] = useState<number | null>(null)
  const [coverUrl, setCoverUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  const [saving, setSaving] = useState<false | 'draft' | 'publish'>(false)
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
      const res = await fetch('/studio/api/upload-cover', {
        method: 'POST',
        body: fd,
        credentials: 'include',
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || 'Не удалось загрузить обложку')
      } else {
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

  async function save(publish: boolean) {
    setError(null)
    if (!title.trim()) {
      setError('Укажите заголовок')
      return
    }
    setSaving(publish ? 'publish' : 'draft')
    try {
      const res = await fetch('/studio/api/create-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: title.trim(),
          body,
          categoryId: categoryId || undefined,
          minTierId: minTierId || undefined,
          coverId: coverId || undefined,
          publish,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || 'Не удалось сохранить')
        setSaving(false)
        return
      }
      // успех → на ленту
      router.push('/studio/posts')
      router.refresh()
    } catch {
      setError('Ошибка соединения')
      setSaving(false)
    }
  }

  return (
    <div className="composer">
      {/* Шапка композера */}
      <div className="composer__head">
        <Link href="/studio/posts" className="studio-back">
          <ArrowLeft size={16} />
          К публикациям
        </Link>
        <div className="composer__actions">
          <button
            className="studio-btn studio-btn--ghost"
            onClick={() => save(false)}
            disabled={saving !== false}
          >
            {saving === 'draft' ? <Loader2 size={16} className="spin" /> : null}
            Черновик
          </button>
          <button
            className="studio-btn studio-btn--primary"
            onClick={() => save(true)}
            disabled={saving !== false}
          >
            {saving === 'publish' ? <Loader2 size={16} className="spin" /> : null}
            Опубликовать
          </button>
        </div>
      </div>

      {error && <div className="studio-login__error composer__error">{error}</div>}

      <div className="composer__grid">
        {/* Центр: контент */}
        <div className="composer__main">
          <input
            className="composer__title"
            placeholder="Заголовок публикации"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          {slugPreview && (
            <div className="composer__slug">/{slugPreview}</div>
          )}

          {/* Обложка */}
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

          {/* Тело */}
          <textarea
            className="studio-textarea composer__body"
            placeholder="Текст публикации. Разделяйте абзацы пустой строкой."
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={14}
          />
        </div>

        {/* Правая панель: настройки */}
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
            <CategoryPicker
              categories={categories}
              value={categoryId}
              onChange={setCategoryId}
            />
          </div>
        </aside>
      </div>
    </div>
  )
}
