'use client'

import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X, Loader2, Check, Plus, Trash2, GripVertical, ImagePlus } from 'lucide-react'
import { StudioSelect } from '../_ui/StudioSelect'

/**
 * Выдвижная панель редактирования секции «Участники» (heroTeam) из конструктора
 * главной. Портал в body + .studio-portal (как PageEditPanel): панель вызывается
 * из-под вкладок настроек, где предок создаёт stacking/containing-контекст, из-за
 * чего position:fixed съезжал. Структура классов — catedit__*.
 *
 * Данные подгружаются при открытии (GET /studio/api/settings/hero-team/get),
 * категории для селекта — GET /studio/api/settings/categories-list,
 * фото — POST /studio/api/upload-cover (multipart, → { id, url }),
 * сохранение — POST /studio/api/settings/hero-team.
 */

type Member = {
  photoId: number | string | null
  photoUrl: string | null
  name: string
  categoryId: number | string | null
}

type Category = { id: number | string; title: string }

const AVATAR_SIZES = [
  { value: '48', label: 'Мелкие (48px)' },
  { value: '64', label: 'Средние (64px)' },
  { value: '96', label: 'Крупные (96px)' },
  { value: '128', label: 'Очень крупные (128px)' },
]

const NO_CATEGORY = '' // пустое значение селекта = без ссылки

export function HeroTeamEditPanel({
  onClose,
  onSaved,
}: {
  onClose: () => void
  onSaved: () => void
}) {
  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [members, setMembers] = useState<Member[]>([])
  const [caption, setCaption] = useState('')
  const [avatarSize, setAvatarSize] = useState('96')
  const [categories, setCategories] = useState<Category[]>([])
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fileInput = useRef<HTMLInputElement>(null)

  // createPortal доступен только на клиенте — монтируемся после первого рендера.
  useEffect(() => {
    setMounted(true)
  }, [])

  // Загрузка текущего heroTeam и списка категорий при открытии.
  useEffect(() => {
    let stop = false
    setLoading(true)
    setError(null)
    Promise.all([
      fetch('/studio/api/settings/hero-team/get', { credentials: 'include' }).then((r) => r.json()),
      fetch('/studio/api/settings/categories-list', { credentials: 'include' }).then((r) => r.json()),
    ])
      .then(([htRes, catRes]) => {
        if (stop) return
        if (htRes?.error) {
          setError(htRes.error)
        } else if (htRes?.heroTeam) {
          setMembers(Array.isArray(htRes.heroTeam.members) ? htRes.heroTeam.members : [])
          setCaption(htRes.heroTeam.caption || '')
          setAvatarSize(htRes.heroTeam.avatarSize || '96')
        }
        if (Array.isArray(catRes?.categories)) setCategories(catRes.categories)
      })
      .catch(() => !stop && setError('Не удалось загрузить данные'))
      .finally(() => !stop && setLoading(false))
    return () => {
      stop = true
    }
  }, [])

  function updateMember(i: number, patch: Partial<Member>) {
    setMembers((ms) => ms.map((m, idx) => (idx === i ? { ...m, ...patch } : m)))
  }
  function removeMember(i: number) {
    setMembers((ms) => ms.filter((_, idx) => idx !== i))
  }

  // drag-n-drop переупорядочивание (паттерн GalleryComposer)
  function onDrop(target: number) {
    if (dragIndex === null || dragIndex === target) return
    setMembers((ms) => {
      const next = [...ms]
      const [moved] = next.splice(dragIndex, 1)
      next.splice(target, 0, moved)
      return next
    })
    setDragIndex(null)
  }

  // «Добавить участника» → сразу выбор файла; после загрузки создаём участника
  // с фото (пустых участников без фото не создаём — photo обязателен).
  function pickPhoto() {
    setError(null)
    fileInput.current?.click()
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (fileInput.current) fileInput.current.value = ''
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
      if (!res.ok || json.error) {
        setError(json.error || 'Не удалось загрузить фото')
      } else {
        setMembers((ms) => [
          ...ms,
          { photoId: json.id, photoUrl: json.url ?? null, name: '', categoryId: null },
        ])
      }
    } catch {
      setError('Ошибка загрузки фото')
    } finally {
      setUploading(false)
    }
  }

  async function save() {
    setError(null)
    // photo обязателен у каждого участника — но т.к. добавляем только с фото,
    // это подстраховка на случай битого состояния.
    for (const m of members) {
      if (m.photoId === null || m.photoId === undefined || m.photoId === '') {
        setError('У каждого участника должно быть фото')
        return
      }
    }
    setSaving(true)
    try {
      const body = {
        members: members.map((m) => ({
          photo: m.photoId,
          name: m.name,
          category: m.categoryId,
        })),
        caption,
        avatarSize,
      }
      const res = await fetch('/studio/api/settings/hero-team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok || json.error) {
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

  const categoryOptions = [
    { value: NO_CATEGORY, label: '— без ссылки —' },
    ...categories.map((c) => ({ value: String(c.id), label: c.title })),
  ]

  const panel = (
    <div className="studio-portal">
      <div className="catedit__overlay" onClick={onClose}>
        <div className="catedit" onClick={(e) => e.stopPropagation()}>
          <div className="catedit__head">
            <h3>Редактирование участников</h3>
            <button className="catmgr__icon-btn" onClick={onClose} title="Закрыть">
              <X size={18} />
            </button>
          </div>

          <div className="catedit__body">
            {loading ? (
              <div className="menubld__loading">
                <Loader2 size={18} className="spin" /> Загрузка…
              </div>
            ) : (
              <>
                <div className="studio-field">
                  <span className="studio-field__label">Размер аватаров</span>
                  <StudioSelect
                    value={avatarSize}
                    onChange={(v) => setAvatarSize(v)}
                    options={AVATAR_SIZES}
                    ariaLabel="Размер аватаров"
                  />
                </div>

                <div className="studio-field">
                  <span className="studio-field__label">Участники</span>
                  {members.length === 0 ? (
                    <p className="settings__hint">
                      Участников нет. Добавьте — фото обязательно у каждого.
                    </p>
                  ) : (
                    <div className="htedit__list">
                      {members.map((m, i) => (
                        <div
                          key={i}
                          className={`htedit__item${dragIndex === i ? ' is-dragging' : ''}`}
                          draggable
                          onDragStart={() => setDragIndex(i)}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={() => onDrop(i)}
                          onDragEnd={() => setDragIndex(null)}
                        >
                          <span className="htedit__grip" title="Перетащите для порядка">
                            <GripVertical size={16} />
                          </span>
                          <span className="htedit__avatar">
                            {m.photoUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={m.photoUrl} alt={m.name || ''} draggable={false} />
                            ) : (
                              <span className="htedit__avatar-empty">
                                <ImagePlus size={16} />
                              </span>
                            )}
                          </span>
                          <div className="htedit__fields">
                            <input
                              className="studio-input"
                              placeholder="Имя (для alt-текста)"
                              value={m.name}
                              onChange={(e) => updateMember(i, { name: e.target.value })}
                            />
                            <StudioSelect
                              value={m.categoryId == null ? NO_CATEGORY : String(m.categoryId)}
                              onChange={(v) =>
                                updateMember(i, { categoryId: v === NO_CATEGORY ? null : v })
                              }
                              options={categoryOptions}
                              ariaLabel="Категория-ссылка"
                            />
                          </div>
                          <button
                            className="catmgr__icon-btn catmgr__icon-btn--danger"
                            onClick={() => removeMember(i)}
                            title="Убрать участника"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <button
                    className="studio-btn studio-btn--ghost settings__add"
                    onClick={pickPhoto}
                    disabled={uploading}
                  >
                    {uploading ? <Loader2 size={16} className="spin" /> : <Plus size={16} />}
                    Добавить участника
                  </button>
                  <input
                    ref={fileInput}
                    type="file"
                    accept="image/*"
                    onChange={handleFile}
                    style={{ display: 'none' }}
                  />
                </div>

                <div className="studio-field">
                  <span className="studio-field__label">Подпись</span>
                  <textarea
                    className="studio-input"
                    rows={3}
                    placeholder="Текст справа от аватаров. Переносы строк сохраняются."
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                  />
                </div>

                {error && <div className="studio-login__error">{error}</div>}
              </>
            )}
          </div>

          <div className="catedit__foot">
            <button className="studio-btn studio-btn--ghost" onClick={onClose}>
              Отмена
            </button>
            <button
              className="studio-btn studio-btn--primary"
              onClick={save}
              disabled={saving || loading || uploading}
            >
              {saving ? <Loader2 size={16} className="spin" /> : <Check size={16} />}
              Сохранить
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  if (!mounted) return null
  return createPortal(panel, document.body)
}
