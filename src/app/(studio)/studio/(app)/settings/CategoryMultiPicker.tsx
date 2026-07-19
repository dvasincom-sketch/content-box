'use client'

import React, { useMemo, useState } from 'react'
import { ChevronRight, Search, X, Check } from 'lucide-react'

export type CatItem = { id: number | string; title: string; parentId: number | string | null }

type TreeNode = CatItem & { children: TreeNode[] }

/** Строит дерево из плоского списка по parentId. (Логика из CategoryPicker.) */
function buildTree(items: CatItem[]): TreeNode[] {
  const byId = new Map<string, TreeNode>()
  items.forEach((it) => byId.set(String(it.id), { ...it, children: [] }))

  const roots: TreeNode[] = []
  byId.forEach((node) => {
    const pid = node.parentId != null ? String(node.parentId) : null
    if (pid && byId.has(pid)) {
      byId.get(pid)!.children.push(node)
    } else {
      roots.push(node)
    }
  })

  const sortRec = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => a.title.localeCompare(b.title, 'ru'))
    nodes.forEach((n) => sortRec(n.children))
  }
  sortRec(roots)
  return roots
}

/**
 * Множественный выбор категорий: дерево + поиск + чекбоксы (multi-версия
 * CategoryPicker). Отвечает ТОЛЬКО за состав выбранных (value — массив id).
 * Порядок выбранных задаётся снаружи (верхний dnd-список в панели плиток),
 * поэтому «выбранное сверху» здесь не показываем.
 *
 * Клик по категории добавляет/убирает её из value (toggle). Раскрытие веток
 * (ChevronRight) — отдельно от выбора, как в оригинале.
 */
export function CategoryMultiPicker({
  categories,
  value,
  onChange,
}: {
  categories: CatItem[]
  value: string[]
  onChange: (ids: string[]) => void
}) {
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const tree = useMemo(() => buildTree(categories), [categories])
  const selectedSet = useMemo(() => new Set(value), [value])

  // Фильтр по названию. При активном поиске — плоский список совпадений.
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return null
    return categories
      .filter((c) => c.title.toLowerCase().includes(q))
      .sort((a, b) => a.title.localeCompare(b.title, 'ru'))
      .slice(0, 50)
  }, [query, categories])

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // toggle выбора: добавляем в конец (порядок правится в панели) или убираем.
  function togglePick(id: string) {
    if (selectedSet.has(id)) {
      onChange(value.filter((v) => v !== id))
    } else {
      onChange([...value, id])
    }
  }

  return (
    <div className="catpick">
      {/* Поиск */}
      <div className="catpick__search">
        <Search size={14} className="catpick__search-icon" />
        <input
          className="catpick__search-input"
          placeholder="Поиск категории…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {query && (
          <button className="catpick__search-clear" onClick={() => setQuery('')} title="Очистить">
            <X size={14} />
          </button>
        )}
      </div>

      {/* Список: результаты поиска ИЛИ дерево */}
      <div className="catpick__scroll">
        {matches ? (
          matches.length === 0 ? (
            <div className="catpick__empty">Ничего не найдено</div>
          ) : (
            matches.map((c) => {
              const id = String(c.id)
              const isSelected = selectedSet.has(id)
              return (
                <button
                  key={c.id}
                  className={`catpick__leaf${isSelected ? ' is-selected' : ''}`}
                  onClick={() => togglePick(id)}
                >
                  {isSelected && <Check size={14} className="catpick__check" />}
                  <span>{c.title}</span>
                </button>
              )
            })
          )
        ) : (
          tree.map((node) => (
            <TreeRow
              key={node.id}
              node={node}
              depth={0}
              expanded={expanded}
              onToggleExpand={toggleExpand}
              selectedSet={selectedSet}
              onTogglePick={togglePick}
            />
          ))
        )}
      </div>
    </div>
  )
}

function TreeRow({
  node,
  depth,
  expanded,
  onToggleExpand,
  selectedSet,
  onTogglePick,
}: {
  node: TreeNode
  depth: number
  expanded: Set<string>
  onToggleExpand: (id: string) => void
  selectedSet: Set<string>
  onTogglePick: (id: string) => void
}) {
  const id = String(node.id)
  const hasChildren = node.children.length > 0
  const isOpen = expanded.has(id)
  const isSelected = selectedSet.has(id)

  return (
    <>
      <div
        className={`catpick__row${isSelected ? ' is-selected' : ''}`}
        style={{ paddingLeft: `calc(var(--st-space-2) + ${depth * 16}px)` }}
      >
        {hasChildren ? (
          <button
            className="catpick__toggle"
            onClick={() => onToggleExpand(id)}
            aria-label={isOpen ? 'Свернуть' : 'Развернуть'}
          >
            <ChevronRight size={14} className={isOpen ? 'catpick__chev is-open' : 'catpick__chev'} />
          </button>
        ) : (
          <span className="catpick__toggle catpick__toggle--empty" />
        )}
        <button className="catpick__label" onClick={() => onTogglePick(id)}>
          {isSelected && <Check size={14} className="catpick__check" />}
          <span>{node.title}</span>
        </button>
      </div>

      {hasChildren &&
        isOpen &&
        node.children.map((child) => (
          <TreeRow
            key={child.id}
            node={child}
            depth={depth + 1}
            expanded={expanded}
            onToggleExpand={onToggleExpand}
            selectedSet={selectedSet}
            onTogglePick={onTogglePick}
          />
        ))}
    </>
  )
}
