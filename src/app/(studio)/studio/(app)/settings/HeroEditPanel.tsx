'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Loader2, Check, Trash2, GripVertical, ImagePlus } from 'lucide-react'
import { CategoryMultiPicker, type CatItem } from './CategoryMultiPicker'

/**
 * Выдвижная панель редактирования секции «Hero» (заголовок главной).
 * Портал в body + .studio-portal (как HeroTeamEditPanel).
 *
 * Редактирует ОДНИМ сохранением: тексты (eyebrow, titleLines) + чипсы
 * (heroChips — категории под заголовком). Чиповая часть — как в
 * HomeCategoriesEditPanel: верхний dnd-список выбранных + CategoryMultiPicker.
 *
 * GET /studio/api/settings/hero/get — тексты + выбранные чипсы (порядок, обложки);
 * GET /studio/api/settings/categories-list — все категории (дерево + метаданные);
 * POST /studio/api/settings/hero — сохранение текстов + массива chip-id.
 */

type CatMeta = { title: string; coverUrl: string | null }

export function HeroEditPanel({
  onClose,
  onSaved,
}: {
  onClose: () => void
  onSaved: () => void
}) {
  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [eyebrow, setEyebrow] = useState('')
  const [titleLines, setTitleLines] = useState('')
  const [allCategories, setAllCategories] = useState<CatItem[]>([])
  const [catMap, setCatMap] = useState<Map<string, CatMeta>>(new Map())
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Загрузка текстов + выбранных чипсов + всех категорий (для дерева).
  useEffect(() => {
    let stop = false
    setLoading(true)
    setError(null)
    Promise.all([
      fetch('/studio/api/settings/hero/get', { credentials: 'include' }).then((r) => r.json()),
      fetch('/studio/api/settings/categories-list', { credentials: 'include' }).then((r) => r.json()),
    ])
      .then(([heroRes, listRes]) => {
        if (stop) return
        if (heroRes?.error) setError(heroRes.error)

        if (heroRes?.hero) {
          setEyebrow(heroRes.hero.eyebrow ?? '')
          setTitleLines(heroRes.hero.titleLines ?? '')
        }

        const map = new Map<string, CatMeta>()

        const list: any[] = Array.isArray(listRes?.categories) ? listRes.categories : []
        const cats: CatItem[] = list.map((c) => ({
          id: c.id,
          title: c.title ?? '',
          parentId: c.parentId ?? null,
        }))
        for (const c of list) {
          map.set(String(c.id), { title: c.title ?? '', coverUrl: c.coverUrl ?? null })
        }

        const chips: any[] = Array.isArray(heroRes?.chips) ? heroRes.chips : []
        for (const s of chips) {
          map.set(String(s.id), { title: s.title ?? '', coverUrl: s.coverUrl ?? null })
        }

        setAllCategories(cats)
        setCatMap(map)
        setSelectedIds(chips.map((s) => String(s.id)))
      })
      .catch(() => !stop && setError('Не удалось загрузить данные'))
      .finally(() => !stop && setLoading(false))
    return () => {
      stop = true
    }
  }, [])

  function removeAt(i: number) {
    setSelectedIds((ids) => ids.filter((_, idx) => idx !== i))
  }

  function onDrop(target: number) {
    if (dragIndex === null || dragIndex === target) return
    setSelectedIds((ids) => {
      const next = [...ids]
      const [moved] = next.splice(dragIndex, 1)
      next.splice(target, 0, moved)
      return next
    })
    setDragIndex(null)
  }

  async function save() {
    setError(null)
    setSaving(true)
    try {
      const res = await fetch('/studio/api/settings/hero', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ eyebrow, titleLines, chips: selectedIds }),
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

  const panel = (
    <div className="studio-portal">
      <div className="catedit__overlay" onClick={onClose}>
        <div className="catedit" onClick={(e) => e.stopPropagation()}>
          <div className="catedit__head">
            <h3>Заголовок главной (Hero)</h3>
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
                  <span className="studio-field__label">Надпись над заголовком</span>
                  <input
                    className="studio-input"
                    placeholder="Напр. BTS TV · 24/7 Broadcast"
                    value={eyebrow}
                    onChange={(e) => setEyebrow(e.target.value)}
                  />
                  <div className="catedit__slug">
                    Мелкая надпись-бейдж над слоганом. Пусто — значение по умолчанию.
                  </div>
                </div>

                <div className="studio-field">
                  <span className="studio-field__label">Заголовок-слоган</span>
                  <textarea
                    className="studio-input"
                    rows={3}
                    placeholder={'Полные выпуски BTS\nс русской озвучкой'}
                    value={titleLines}
                    onChange={(e) => setTitleLines(e.target.value)}
                  />
                  <div className="catedit__slug">
                    Каждая строка — отдельная строка заголовка. Последняя строка выделяется
                    градиентом. Пусто — значение по умолчанию.
                  </div>
                </div>

                <div className="studio-field">
                  <span className="studio-field__label">Категории-чипсы под заголовком</span>
                  {selectedIds.length === 0 ? (
                    <p className="settings__hint">
                      Чипсов нет. Отметьте категории в списке ниже — они появятся здесь.
                    </p>
                  ) : (
                    <div className="htedit__list">
                      {selectedIds.map((id, i) => {
                        const meta = catMap.get(id)
                        return (
                          <div
                            key={id}
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
                              {meta?.coverUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={meta.coverUrl} alt={meta.title || ''} draggable={false} />
                              ) : (
                                <span className="htedit__avatar-empty">
                                  <ImagePlus size={16} />
                                </span>
                              )}
                            </span>
                            <span className="htedit__cat-title">{meta?.title || 'Без названия'}</span>
                            <button
                              className="catmgr__icon-btn catmgr__icon-btn--danger"
                              onClick={() => removeAt(i)}
                              title="Убрать чипс"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  <div style={{ marginTop: 'var(--st-space-3)' }}>
                    <CategoryMultiPicker
                      categories={allCategories}
                      value={selectedIds}
                      onChange={setSelectedIds}
                    />
                  </div>
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
              disabled={saving || loading}
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
