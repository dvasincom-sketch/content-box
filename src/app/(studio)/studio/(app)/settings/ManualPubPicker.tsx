'use client'

import React, { useEffect, useRef, useState } from 'react'
import { Loader2, Search, X, GripVertical, Plus, Check } from 'lucide-react'

/** Публикация в пикере (ответ /studio/api/publications-pick). */
type PickItem = { id: number; title: string; posterUrl: string | null; published?: boolean }

/** Максимум публикаций в ручной подборке (синхронно с sanitizeSectionConfig). */
export const MANUAL_PICK_MAX = 50

/**
 * Ручной выбор публикаций для секции главной (source.kind = 'manual').
 * Поиск по названию (с задержкой) + список выбранных: drag-n-drop порядок,
 * удаление. Порядок списка = порядок на витрине. Наружу отдаёт только id.
 */
export function ManualPubPicker({
  value,
  onChange,
}: {
  value: number[]
  onChange: (ids: number[]) => void
}) {
  // Кэш метаданных (название/обложка) по id — для отображения выбранных.
  const [meta, setMeta] = useState<Map<number, PickItem>>(new Map())
  const [metaLoading, setMetaLoading] = useState(false)
  const [q, setQ] = useState('')
  const [results, setResults] = useState<PickItem[]>([])
  const [searching, setSearching] = useState(false)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const reqSeq = useRef(0)

  const mapItem = (x: any): PickItem => ({
    id: Number(x.id),
    title: String(x.title || ''),
    posterUrl: x.posterUrl ?? null,
    published: x.published,
  })

  // Подгрузить метаданные уже выбранных id (один раз на набор неизвестных id).
  useEffect(() => {
    const missing = value.filter((id) => !meta.has(id))
    if (!missing.length) return
    setMetaLoading(true)
    fetch(`/studio/api/publications-pick?ids=${missing.join(',')}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((res) => {
        const items: any[] = Array.isArray(res?.items) ? res.items : []
        setMeta((m) => {
          const next = new Map(m)
          items.forEach((x) => next.set(Number(x.id), mapItem(x)))
          return next
        })
      })
      .catch(() => {})
      .finally(() => setMetaLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.join(',')])

  // Поиск по названию с задержкой 300 мс; пустой запрос — последние публикации.
  useEffect(() => {
    const seq = ++reqSeq.current
    setSearching(true)
    const t = setTimeout(() => {
      fetch(`/studio/api/publications-pick?q=${encodeURIComponent(q.trim())}`, { credentials: 'include' })
        .then((r) => r.json())
        .then((res) => {
          if (seq !== reqSeq.current) return
          const items = (Array.isArray(res?.items) ? res.items : []).map(mapItem)
          setResults(items)
          setMeta((m) => {
            const next = new Map(m)
            items.forEach((x: PickItem) => next.set(x.id, x))
            return next
          })
        })
        .catch(() => seq === reqSeq.current && setResults([]))
        .finally(() => seq === reqSeq.current && setSearching(false))
    }, 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  const selected = new Set(value)
  const full = value.length >= MANUAL_PICK_MAX

  function add(id: number) {
    if (selected.has(id) || full) return
    onChange([...value, id])
  }
  function remove(id: number) {
    onChange(value.filter((x) => x !== id))
  }
  function onDrop(target: number) {
    if (dragIndex === null || dragIndex === target) return
    const next = [...value]
    const [moved] = next.splice(dragIndex, 1)
    next.splice(target, 0, moved)
    setDragIndex(null)
    onChange(next)
  }

  const thumb = (url: string | null) =>
    url ? (
      <img src={url} alt="" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }} />
    ) : (
      <span style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--st-border)', flexShrink: 0 }} />
    )

  const draftBadge = (it?: PickItem) =>
    it && it.published === false ? (
      <span style={{ fontSize: 11, color: 'var(--st-text-muted)', border: '1px solid var(--st-border)', borderRadius: 6, padding: '1px 6px', flexShrink: 0 }}>
        черновик
      </span>
    ) : null

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '6px 8px',
    borderRadius: 10,
    border: '1px solid var(--st-border)',
    background: 'var(--st-bg, transparent)',
  }
  const titleStyle: React.CSSProperties = {
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontSize: 14,
  }

  return (
    <div style={{ display: 'grid', gap: 'var(--st-space-3, 12px)' }}>
      {/* Выбранные — в порядке показа на главной */}
      <div className="studio-field">
        <span className="studio-field__label">
          Выбрано: {value.length}
          {full ? ` (максимум ${MANUAL_PICK_MAX})` : ''}
        </span>
        {value.length === 0 ? (
          <span className="settings__hint">
            Пока пусто — найдите публикации ниже и добавьте. Пока список пуст, секция показывает ленту по умолчанию.
          </span>
        ) : (
          <div style={{ display: 'grid', gap: 6 }}>
            {value.map((id, i) => {
              const it = meta.get(id)
              return (
                <div
                  key={id}
                  style={{ ...rowStyle, opacity: dragIndex === i ? 0.5 : 1 }}
                  draggable
                  onDragStart={() => setDragIndex(i)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => onDrop(i)}
                  onDragEnd={() => setDragIndex(null)}
                >
                  <span className="homebld__grip" title="Перетащите для порядка" style={{ cursor: 'grab' }}>
                    <GripVertical size={16} />
                  </span>
                  <span className="homebld__num">{i + 1}</span>
                  {thumb(it?.posterUrl ?? null)}
                  <span style={titleStyle}>
                    {it ? it.title || 'Без названия' : metaLoading ? 'Загрузка…' : `Публикация #${id} (не найдена)`}
                  </span>
                  {draftBadge(it)}
                  <button
                    type="button"
                    className="catmgr__icon-btn"
                    onClick={() => remove(id)}
                    title="Убрать из подборки"
                    aria-label="Убрать из подборки"
                  >
                    <X size={15} />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Поиск */}
      <label className="studio-field">
        <span className="studio-field__label">Найти публикацию</span>
        <div style={{ position: 'relative' }}>
          <Search
            size={15}
            style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--st-text-muted)', pointerEvents: 'none' }}
          />
          <input
            className="studio-input"
            type="search"
            value={q}
            placeholder="Начните вводить название…"
            onChange={(e) => setQ(e.target.value)}
            style={{ paddingLeft: 32 }}
          />
        </div>
      </label>

      <div style={{ display: 'grid', gap: 6, maxHeight: 320, overflowY: 'auto' }}>
        {searching && results.length === 0 ? (
          <span className="settings__hint" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Loader2 size={14} className="spin" /> Поиск…
          </span>
        ) : results.length === 0 ? (
          <span className="settings__hint">Ничего не найдено.</span>
        ) : (
          results.map((it) => {
            const isSel = selected.has(it.id)
            return (
              <div key={it.id} style={rowStyle}>
                {thumb(it.posterUrl)}
                <span style={titleStyle}>{it.title || 'Без названия'}</span>
                {draftBadge(it)}
                <button
                  type="button"
                  className="catmgr__icon-btn"
                  onClick={() => (isSel ? remove(it.id) : add(it.id))}
                  disabled={!isSel && full}
                  title={isSel ? 'Убрать из подборки' : 'Добавить в подборку'}
                  aria-label={isSel ? 'Убрать из подборки' : 'Добавить в подборку'}
                >
                  {isSel ? <Check size={15} /> : <Plus size={15} />}
                </button>
              </div>
            )
          })
        )}
      </div>
      <span style={{ fontSize: 12, color: 'var(--st-text-muted)' }}>
        Черновики на главной не показываются — появятся после публикации.
      </span>
    </div>
  )
}
