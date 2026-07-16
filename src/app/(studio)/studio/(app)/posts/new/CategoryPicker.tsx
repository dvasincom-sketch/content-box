'use client'

import React, { useMemo, useState } from 'react'
import { ChevronRight, Search, X, Check } from 'lucide-react'

export type CatItem = { id: number | string; title: string; parentId: number | string | null }

type TreeNode = CatItem & { children: TreeNode[] }

/** Строит дерево из плоского списка по parentId. */
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

export function CategoryPicker({
  categories,
  value,
  onChange,
}: {
  categories: CatItem[]
  value: string
  onChange: (id: string) => void
}) {
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const tree = useMemo(() => buildTree(categories), [categories])
  const selected = categories.find((c) => String(c.id) === value) || null

  // Фильтр по названию. При активном поиске показываем плоский список совпадений.
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return null
    return categories
      .filter((c) => c.title.toLowerCase().includes(q))
      .sort((a, b) => a.title.localeCompare(b.title, 'ru'))
      .slice(0, 50)
  }, [query, categories])

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function pick(id: string) {
    onChange(id === value ? '' : id) // повторный клик снимает выбор
  }

  return (
    <div className="catpick">
      {/* Текущий выбор */}
      {selected && (
        <div className="catpick__selected">
          <span className="catpick__selected-title">{selected.title}</span>
          <button
            className="catpick__clear"
            onClick={() => onChange('')}
            title="Убрать категорию"
          >
            <X size={14} />
          </button>
        </div>
      )}

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
            matches.map((c) => (
              <button
                key={c.id}
                className={`catpick__leaf${String(c.id) === value ? ' is-selected' : ''}`}
                onClick={() => pick(String(c.id))}
              >
                {String(c.id) === value && <Check size={14} className="catpick__check" />}
                <span>{c.title}</span>
              </button>
            ))
          )
        ) : (
          tree.map((node) => (
            <TreeRow
              key={node.id}
              node={node}
              depth={0}
              expanded={expanded}
              onToggle={toggle}
              value={value}
              onPick={pick}
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
  onToggle,
  value,
  onPick,
}: {
  node: TreeNode
  depth: number
  expanded: Set<string>
  onToggle: (id: string) => void
  value: string
  onPick: (id: string) => void
}) {
  const id = String(node.id)
  const hasChildren = node.children.length > 0
  const isOpen = expanded.has(id)
  const isSelected = id === value

  return (
    <>
      <div
        className={`catpick__row${isSelected ? ' is-selected' : ''}`}
        style={{ paddingLeft: `calc(var(--st-space-2) + ${depth * 16}px)` }}
      >
        {hasChildren ? (
          <button
            className="catpick__toggle"
            onClick={() => onToggle(id)}
            aria-label={isOpen ? 'Свернуть' : 'Развернуть'}
          >
            <ChevronRight size={14} className={isOpen ? 'catpick__chev is-open' : 'catpick__chev'} />
          </button>
        ) : (
          <span className="catpick__toggle catpick__toggle--empty" />
        )}
        <button className="catpick__label" onClick={() => onPick(id)}>
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
            onToggle={onToggle}
            value={value}
            onPick={onPick}
          />
        ))}
    </>
  )
}
