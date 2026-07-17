'use client'

import React, { useMemo, useState } from 'react'
import { Search, Plus, X, ChevronUp, ChevronDown, Film } from 'lucide-react'

export type VideoOption = {
  id: number | string
  title: string
  /** ISO-строка даты добавления/публикации, для подписи в списке */
  addedAt: string | null
}

/**
 * Селектор прикрепления видео к публикации.
 * - Все видео тенанта приходят пропом `videos` (клиентский фильтр по названию).
 * - `value` — упорядоченный массив id прикреплённых видео (порядок значим).
 * - Порядок меняется стрелками вверх/вниз; удаление — крестиком.
 *
 * Наружу отдаёт массив id в текущем порядке через onChange.
 */
export function VideoAttachPicker({
  videos,
  value,
  onChange,
}: {
  videos: VideoOption[]
  value: (number | string)[]
  onChange: (ids: (number | string)[]) => void
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)

  // Быстрый доступ к видео по id
  const byId = useMemo(() => {
    const m = new Map<string, VideoOption>()
    for (const v of videos) m.set(String(v.id), v)
    return m
  }, [videos])

  // Прикреплённые — в порядке value
  const attached = useMemo(
    () => value.map((id) => byId.get(String(id))).filter(Boolean) as VideoOption[],
    [value, byId],
  )

  // Кандидаты для добавления: не прикреплённые + подходят под поиск
  const attachedSet = useMemo(() => new Set(value.map(String)), [value])
  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase()
    return videos
      .filter((v) => !attachedSet.has(String(v.id)))
      .filter((v) => (q ? v.title.toLowerCase().includes(q) : true))
      .slice(0, 50)
  }, [videos, attachedSet, query])

  function add(id: number | string) {
    if (attachedSet.has(String(id))) return
    onChange([...value, id])
    setQuery('')
  }

  function remove(id: number | string) {
    onChange(value.filter((x) => String(x) !== String(id)))
  }

  function move(index: number, dir: -1 | 1) {
    const next = [...value]
    const target = index + dir
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }

  return (
    <div className="vpick">
      {/* Прикреплённые */}
      {attached.length > 0 && (
        <ul className="vpick__list">
          {attached.map((v, i) => (
            <li key={v.id} className="vpick__item">
              <span className="vpick__item-icon" aria-hidden>
                <Film size={14} />
              </span>
              <span className="vpick__item-body">
                <span className="vpick__item-title" title={v.title}>
                  {v.title}
                </span>
                {v.addedAt && (
                  <span className="vpick__item-date">{fmtDate(v.addedAt)}</span>
                )}
              </span>
              <span className="vpick__item-order">
                <button
                  type="button"
                  className="vpick__ord-btn"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  title="Выше"
                  aria-label="Переместить выше"
                >
                  <ChevronUp size={14} />
                </button>
                <button
                  type="button"
                  className="vpick__ord-btn"
                  onClick={() => move(i, 1)}
                  disabled={i === attached.length - 1}
                  title="Ниже"
                  aria-label="Переместить ниже"
                >
                  <ChevronDown size={14} />
                </button>
              </span>
              <button
                type="button"
                className="vpick__remove"
                onClick={() => remove(v.id)}
                title="Открепить"
                aria-label="Открепить видео"
              >
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Добавление */}
      {open ? (
        <div className="vpick__search">
          <div className="vpick__search-field">
            <Search size={14} className="vpick__search-icon" aria-hidden />
            <input
              className="vpick__search-input"
              placeholder="Поиск видео по названию…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
            <button
              type="button"
              className="vpick__search-close"
              onClick={() => {
                setOpen(false)
                setQuery('')
              }}
              title="Закрыть"
              aria-label="Закрыть поиск"
            >
              <X size={14} />
            </button>
          </div>

          <ul className="vpick__results">
            {candidates.length === 0 ? (
              <li className="vpick__empty">
                {videos.length === 0
                  ? 'Нет загруженных видео'
                  : query.trim()
                    ? 'Ничего не найдено'
                    : 'Все видео уже прикреплены'}
              </li>
            ) : (
              candidates.map((v) => (
                <li key={v.id}>
                  <button
                    type="button"
                    className="vpick__result"
                    onClick={() => add(v.id)}
                  >
                    <span className="vpick__result-body">
                      <span className="vpick__result-title" title={v.title}>
                        {v.title}
                      </span>
                      {v.addedAt && (
                        <span className="vpick__result-date">{fmtDate(v.addedAt)}</span>
                      )}
                    </span>
                    <Plus size={14} className="vpick__result-add" aria-hidden />
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : (
        <button
          type="button"
          className="vpick__add-btn"
          onClick={() => setOpen(true)}
        >
          <Plus size={16} />
          Прикрепить видео
        </button>
      )}
    </div>
  )
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  } catch {
    return ''
  }
}
