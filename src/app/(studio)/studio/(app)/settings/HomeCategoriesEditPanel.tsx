'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Loader2, Check, Trash2, GripVertical, ImagePlus } from 'lucide-react'
import { CategoryMultiPicker, type CatItem } from './CategoryMultiPicker'

/**
 * Выдвижная панель редактирования секции «Категории» (homeCategories) — плитки
 * на главной. Портал в body + .studio-portal (как HeroTeamEditPanel).
 *
 * Сверху — dnd-список выбранных плиток (превью-обложка + название + порядок +
 * удаление). Снизу — CategoryMultiPicker (дерево + поиск, множественный выбор).
 *
 * Единый источник состава и порядка — selectedIds (массив id-строк). Превью
 * тянется из catMap (метаданные из обоих GET). Пикер меняет состав, верхний
 * список — порядок; рассинхрона нет, т.к. оба пишут в selectedIds.
 *
 * GET /studio/api/settings/home-categories/get — выбранные (порядок + обложки);
 * GET /studio/api/settings/categories-list — все категории (дерево + метаданные);
 * POST /studio/api/settings/home-categories — сохранение массива id.
 */

type CatMeta = { title: string; coverUrl: string | null }

export function HomeCategoriesEditPanel({
  onClose,
  onSaved,
}: {
  onClose: () => void
  onSaved: () => void
}) {
  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [allCategories, setAllCategories] = useState<CatItem[]>([])
  const [catMap, setCatMap] = useState<Map<string, CatMeta>>(new Map())
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // createPortal доступен только на клиенте — монтируемся после первого рендера.
  useEffect(() => {
    setMounted(true)
  }, [])

  // Загрузка выбранных плиток (порядок + обложки) и всех категорий (дерево).
  useEffect(() => {
    let stop = false
    setLoading(true)
    setError(null)
    Promise.all([
      fetch('/studio/api/settings/home-categories/get', { credentials: 'include' }).then((r) => r.json()),
      fetch('/studio/api/settings/categories-list', { credentials: 'include' }).then((r) => r.json()),
    ])
      .then(([selRes, listRes]) => {
        if (stop) return
        if (selRes?.error) setError(selRes.error)

        const map = new Map<string, CatMeta>()

        // метаданные всех категорий (для превью выбранных, добавленных из дерева)
        const list: any[] = Array.isArray(listRes?.categories) ? listRes.categories : []
        const cats: CatItem[] = list.map((c) => ({
          id: c.id,
          title: c.title ?? '',
          parentId: c.parentId ?? null,
        }))
        for (const c of list) {
          map.set(String(c.id), { title: c.title ?? '', coverUrl: c.coverUrl ?? null })
        }

        // выбранные: порядок + их обложки (перекрывают/дополняют карту)
        const selected: any[] = Array.isArray(selRes?.selected) ? selRes.selected : []
        for (const s of selected) {
          map.set(String(s.id), { title: s.title ?? '', coverUrl: s.coverUrl ?? null })
        }

        setAllCategories(cats)
        setCatMap(map)
        setSelectedIds(selected.map((s) => String(s.id)))
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

  // drag-n-drop переупорядочивание выбранных (паттерн GalleryComposer)
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
      const res = await fetch('/studio/api/settings/home-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ categories: selectedIds }),
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
            <h3>Категории на главной</h3>
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
                  <span className="studio-field__label">Выбранные плитки</span>
                  {selectedIds.length === 0 ? (
                    <p className="settings__hint">
                      Плиток нет. Отметьте категории в списке ниже — они появятся здесь.
                      Если список пуст, блок «Категории» на главной не отображается.
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
                              title="Убрать плитку"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                <div className="studio-field">
                  <span className="studio-field__label">Выбор категорий</span>
                  <CategoryMultiPicker
                    categories={allCategories}
                    value={selectedIds}
                    onChange={setSelectedIds}
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
