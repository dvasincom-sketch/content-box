'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Check, GripVertical, Pencil } from 'lucide-react'
import {
  DEFAULT_HOME_SECTIONS,
  HOME_SECTION_DEFS,
  type HomeSectionConfig,
  type HomeSectionType,
} from '@/lib/homeSections'
import { HeroTeamEditPanel } from './HeroTeamEditPanel'
import { HomeCategoriesEditPanel } from './HomeCategoriesEditPanel'

/** type → человекочитаемый лейбл (из единого источника). */
const LABELS: Record<HomeSectionType, string> = HOME_SECTION_DEFS.reduce(
  (acc, d) => {
    acc[d.type] = d.label
    return acc
  },
  {} as Record<HomeSectionType, string>,
)

/**
 * Общий контракт компонента-редактора секции: выдвижная панель, которая сама
 * грузит/сохраняет свои данные (как HeroTeamEditPanel). onClose закрывает,
 * onSaved вызывается после успешного сохранения.
 */
type SectionEditor = (props: { onClose: () => void; onSaved: () => void }) => React.ReactNode

/**
 * Каркас под редактирование контента секций: карта type → редактор.
 * Карандаш показывается только у секций, для которых редактор есть.
 * Добавить редактор новой секции = одна запись сюда (разметку не трогаем).
 */
const SECTION_EDITORS: Partial<Record<HomeSectionType, SectionEditor>> = {
  heroTeam: HeroTeamEditPanel,
  categories: HomeCategoriesEditPanel,
}

/**
 * Конструктор главной: порядок (drag-and-drop) и видимость (тумблер) секций.
 * Начальное состояние — из пропса; пустой пропс → полный дефолт (все секции),
 * чтобы владелец сразу видел и мог тасовать весь набор. Первое сохранение
 * материализует конфиг в SiteSettings.homeSections.
 */
export function HomeBuilder({ initial }: { initial: HomeSectionConfig[] }) {
  const router = useRouter()
  const [rows, setRows] = useState<HomeSectionConfig[]>(
    initial.length > 0 ? initial : DEFAULT_HOME_SECTIONS,
  )
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // какой тип секции сейчас редактируется в выдвижной панели (null — закрыта)
  const [editingType, setEditingType] = useState<HomeSectionType | null>(null)

  const EditorPanel = editingType ? SECTION_EDITORS[editingType] : undefined

  function toggle(i: number) {
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, enabled: !row.enabled } : row)))
    setSaved(false)
  }

  // drag-n-drop переупорядочивание (паттерн GalleryComposer)
  function onDrop(target: number) {
    if (dragIndex === null || dragIndex === target) return
    setRows((r) => {
      const next = [...r]
      const [moved] = next.splice(dragIndex, 1)
      next.splice(target, 0, moved)
      return next
    })
    setDragIndex(null)
    setSaved(false)
  }

  async function save() {
    setError(null)
    setSaved(false)
    setSaving(true)
    try {
      const res = await fetch('/studio/api/settings/home-sections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ homeSections: rows }),
      })
      const json = await res.json()
      if (!res.ok) setError(json.error || 'Не удалось сохранить')
      else setSaved(true)
    } catch {
      setError('Ошибка соединения')
    } finally {
      setSaving(false)
    }
  }

  const enabledCount = rows.filter((r) => r.enabled).length

  return (
    <div className="homebld">
      <p className="settings__hint">
        Перетаскивайте секции за ручку, чтобы задать порядок. Тумблер справа включает или
        выключает секцию. Секции, зависящие от данных (участники, категории), скрываются
        автоматически при отсутствии данных, даже если включены.
      </p>

      <div className="homebld__list">
        {rows.map((row, i) => (
          <div
            key={row.type}
            className={`homebld__item${dragIndex === i ? ' is-dragging' : ''}${
              row.enabled ? '' : ' is-off'
            }`}
            draggable
            onDragStart={() => setDragIndex(i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => onDrop(i)}
            onDragEnd={() => setDragIndex(null)}
          >
            <span className="homebld__grip" title="Перетащите для порядка">
              <GripVertical size={16} />
            </span>
            <span className="homebld__num">{i + 1}</span>
            <span className="homebld__label">{LABELS[row.type]}</span>
            {SECTION_EDITORS[row.type] && (
              <button
                className="catmgr__icon-btn homebld__edit"
                onClick={() => setEditingType(row.type)}
                title="Редактировать содержимое секции"
              >
                <Pencil size={15} />
              </button>
            )}
            <label className="homebld__toggle" title={row.enabled ? 'Показывается' : 'Скрыта'}>
              <input
                type="checkbox"
                checked={row.enabled}
                onChange={() => toggle(i)}
              />
              <span className="homebld__toggle-track" aria-hidden="true">
                <span className="homebld__toggle-thumb" />
              </span>
              <span className="homebld__toggle-text">{row.enabled ? 'Вкл' : 'Выкл'}</span>
            </label>
          </div>
        ))}
      </div>

      {enabledCount === 0 && (
        <div className="settings__hint homebld__warn">
          Все секции выключены — главная будет пустой.
        </div>
      )}

      {error && <div className="settings__err">{error}</div>}

      <div className="settings__save-row">
        {saved && (
          <span className="settings__saved">
            <Check size={15} /> Сохранено
          </span>
        )}
        <button className="studio-btn studio-btn--primary" onClick={save} disabled={saving}>
          {saving ? <Loader2 size={16} className="spin" /> : null}
          Сохранить порядок
        </button>
      </div>

      {EditorPanel && (
        <EditorPanel
          onClose={() => setEditingType(null)}
          onSaved={() => {
            setEditingType(null)
            // освежить возможные превью во вкладке и публичную главную
            router.refresh()
          }}
        />
      )}
    </div>
  )
}
