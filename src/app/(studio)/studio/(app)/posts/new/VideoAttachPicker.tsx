'use client'

import React, { useMemo, useState } from 'react'
import { Search, Plus, X, ChevronUp, ChevronDown, Film, Library } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type VideoOption = {
  id: number | string
  title: string
  /** ISO-строка даты добавления/публикации, для подписи в списке */
  addedAt: string | null
  /** provider записи videos ('audio' для аудио) — для разделения секций */
  provider?: string | null
  /** статус обработки своего видео: 'processing'|'ready'|'error'|null */
  assetStatus?: string | null
  /** id категории записи — для иерархии в «Из библиотеки» */
  categoryId?: number | string | null
}

export type CatNode = { id: number | string; title: string; depth: number }

/**
 * Прикрепление медиа (видео/аудио) к публикации. Единый вид для всех типов:
 * — сверху список прикреплённого (порядок стрелками, удаление крестиком);
 * — тулбар из двух кнопок в один ряд (как у галереи): слева `leadingButton`
 *   (загрузка/добавление нового), справа «Из библиотеки» (прикрепить существующее);
 * — «Из библиотеки» раскрывает поиск. Если задан `categoryTree`, кандидаты
 *   сгруппированы по категориям (иерархия с отступами), иначе — плоским списком.
 */
export function VideoAttachPicker({
  videos,
  value,
  onChange,
  leadingButton,
  categoryTree,
  searchPlaceholder = 'Поиск видео по названию…',
  emptyLabel = 'Нет загруженных видео',
  icon: Icon = Film,
}: {
  videos: VideoOption[]
  value: (number | string)[]
  onChange: (ids: (number | string)[]) => void
  /** Кнопка «загрузить/добавить новое» — первой в тулбаре, рядом с «Из библиотеки». */
  leadingButton?: React.ReactNode
  /** Дерево категорий (плоское, с depth) — включает иерархию в списке библиотеки. */
  categoryTree?: CatNode[]
  searchPlaceholder?: string
  emptyLabel?: string
  icon?: LucideIcon
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)

  const byId = useMemo(() => {
    const m = new Map<string, VideoOption>()
    for (const v of videos) m.set(String(v.id), v)
    return m
  }, [videos])

  const attached = useMemo(
    () => value.map((id) => byId.get(String(id))).filter(Boolean) as VideoOption[],
    [value, byId],
  )

  const attachedSet = useMemo(() => new Set(value.map(String)), [value])
  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase()
    return videos
      .filter((v) => !attachedSet.has(String(v.id)))
      .filter((v) => (q ? v.title.toLowerCase().includes(q) : true))
  }, [videos, attachedSet, query])

  // «Недавно загруженные»: когда поиск пуст — сверху показываем последние по дате
  // добавления, чтобы только что залитое видео было под рукой, а не терялось в
  // алфавитных категориях. При поиске — обычная фильтрация ниже.
  const recent = useMemo(() => {
    if (query.trim()) return null
    const arr = [...candidates]
    arr.sort((a, b) => new Date(b.addedAt || 0).getTime() - new Date(a.addedAt || 0).getTime())
    return arr.slice(0, 8)
  }, [candidates, query])

  // Группировка кандидатов по категориям в порядке дерева (для иерархии).
  const groups = useMemo(() => {
    if (!categoryTree || categoryTree.length === 0) return null
    const byCat = new Map<string, VideoOption[]>()
    for (const v of candidates) {
      const k = v.categoryId != null ? String(v.categoryId) : '∅'
      const arr = byCat.get(k)
      if (arr) arr.push(v)
      else byCat.set(k, [v])
    }
    const out: { key: string; title: string; depth: number; items: VideoOption[] }[] = []
    for (const c of categoryTree) {
      const items = byCat.get(String(c.id))
      if (items && items.length) out.push({ key: String(c.id), title: c.title, depth: c.depth, items })
    }
    // Категории, которых нет в дереве (удалённые), + «Без категории» — в конец.
    const known = new Set(categoryTree.map((c) => String(c.id)))
    const orphans: VideoOption[] = []
    for (const [k, arr] of byCat) {
      if (k !== '∅' && !known.has(k)) orphans.push(...arr)
    }
    const noCat = byCat.get('∅') ?? []
    if (orphans.length) out.push({ key: '∅orphan', title: 'Прочее', depth: 0, items: orphans })
    if (noCat.length) out.push({ key: '∅', title: 'Без категории', depth: 0, items: noCat })
    return out
  }, [candidates, categoryTree])

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

  const statusBadge = (v: VideoOption) => {
    if (v.provider !== 'self' || !v.assetStatus || v.assetStatus === 'ready') return null
    const err = v.assetStatus === 'error'
    return (
      <span
        style={{
          marginLeft: 6, padding: '1px 7px', borderRadius: 999, fontSize: 11, fontWeight: 600,
          color: err ? '#b42318' : '#9a6700',
          background: err ? '#fef3f2' : '#fff7e6',
          border: `1px solid ${err ? '#fecdca' : '#ffe1a8'}`,
          whiteSpace: 'nowrap',
        }}
      >
        {err ? 'ошибка' : 'обрабатывается'}
      </span>
    )
  }

  const resultBtn = (v: VideoOption) => (
    <button type="button" className="vpick__result" onClick={() => add(v.id)}>
      <span className="vpick__result-body">
        <span className="vpick__result-title" title={v.title}>{v.title}{statusBadge(v)}</span>
        {v.addedAt && <span className="vpick__result-date">{fmtDate(v.addedAt)}</span>}
      </span>
      <Plus size={14} className="vpick__result-add" aria-hidden />
    </button>
  )

  return (
    <div className="vpick">
      {/* Прикреплённые */}
      {attached.length > 0 && (
        <ul className="vpick__list">
          {attached.map((v, i) => (
            <li key={v.id} className="vpick__item">
              <span className="vpick__item-icon" aria-hidden>
                <Icon size={14} />
              </span>
              <span className="vpick__item-body">
                <span className="vpick__item-title" title={v.title}>{v.title}{statusBadge(v)}</span>
                {v.addedAt && <span className="vpick__item-date">{fmtDate(v.addedAt)}</span>}
              </span>
              <span className="vpick__item-order">
                <button type="button" className="vpick__ord-btn" onClick={() => move(i, -1)} disabled={i === 0} title="Выше" aria-label="Переместить выше">
                  <ChevronUp size={14} />
                </button>
                <button type="button" className="vpick__ord-btn" onClick={() => move(i, 1)} disabled={i === attached.length - 1} title="Ниже" aria-label="Переместить ниже">
                  <ChevronDown size={14} />
                </button>
              </span>
              <button type="button" className="vpick__remove" onClick={() => remove(v.id)} title="Открепить" aria-label="Открепить">
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Тулбар: две кнопки в ряд (как у галереи) */}
      <div className="gcomp__actions">
        {leadingButton}
        <button
          type="button"
          className="gcomp__add gcomp__add--ghost"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
        >
          <Library size={16} /> Из библиотеки
        </button>
      </div>

      {open && (
        <div className="vpick__search">
          <div className="vpick__search-field">
            <Search size={14} className="vpick__search-icon" aria-hidden />
            <input
              className="vpick__search-input"
              placeholder={searchPlaceholder}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
            <button type="button" className="vpick__search-close" onClick={() => { setOpen(false); setQuery('') }} title="Закрыть" aria-label="Закрыть поиск">
              <X size={14} />
            </button>
          </div>

          <ul className="vpick__results">
            {candidates.length === 0 ? (
              <li className="vpick__empty">
                {videos.length === 0 ? emptyLabel : query.trim() ? 'Ничего не найдено' : 'Всё уже прикреплено'}
              </li>
            ) : (
              <>
                {recent && recent.length > 0 && (
                  <React.Fragment>
                    <li className="vpick__group">Недавно загруженные</li>
                    {recent.map((v) => (
                      <li key={`recent-${v.id}`}>{resultBtn(v)}</li>
                    ))}
                  </React.Fragment>
                )}
                {groups ? (
                  groups.map((g) => (
                <React.Fragment key={g.key}>
                  <li className="vpick__group" style={{ paddingLeft: `${8 + g.depth * 14}px` }}>{g.title}</li>
                  {g.items.map((v) => (
                    <li key={v.id} style={{ paddingLeft: `${g.depth * 14}px` }}>{resultBtn(v)}</li>
                  ))}
                </React.Fragment>
              ))
                ) : (
                  candidates.map((v) => <li key={v.id}>{resultBtn(v)}</li>)
                )}
              </>
            )}
          </ul>
        </div>
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
