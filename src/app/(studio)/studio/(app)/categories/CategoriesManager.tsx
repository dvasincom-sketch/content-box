'use client'

import React, { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ChevronRight,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  Loader2,
  FolderTree,
} from 'lucide-react'

type Cat = { id: number | string; title: string; slug: string; parentId: number | string | null }
type TreeNode = Cat & { children: TreeNode[] }

function buildTree(items: Cat[]): TreeNode[] {
  const byId = new Map<string, TreeNode>()
  items.forEach((it) => byId.set(String(it.id), { ...it, children: [] }))
  const roots: TreeNode[] = []
  byId.forEach((node) => {
    const pid = node.parentId != null ? String(node.parentId) : null
    if (pid && byId.has(pid)) byId.get(pid)!.children.push(node)
    else roots.push(node)
  })
  const sortRec = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => a.title.localeCompare(b.title, 'ru'))
    nodes.forEach((n) => sortRec(n.children))
  }
  sortRec(roots)
  return roots
}

export function CategoriesManager({ initialCategories }: { initialCategories: Cat[] }) {
  const router = useRouter()
  const [cats] = useState<Cat[]>(initialCategories)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState<string | null>(null) // id операции
  const [error, setError] = useState<string | null>(null)

  // Инлайн-редактирование: id → черновик названия
  const [editing, setEditing] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')

  // Форма создания
  const [creating, setCreating] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newParent, setNewParent] = useState<string>('')

  const tree = useMemo(() => buildTree(cats), [cats])

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function refresh() {
    router.refresh()
  }

  async function createCat() {
    setError(null)
    if (!newTitle.trim()) {
      setError('Укажите название')
      return
    }
    setBusy('create')
    try {
      const res = await fetch('/studio/api/categories/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ title: newTitle.trim(), parentId: newParent || undefined }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || 'Не удалось создать')
      } else {
        setNewTitle('')
        setNewParent('')
        setCreating(false)
        await refresh()
      }
    } catch {
      setError('Ошибка соединения')
    } finally {
      setBusy(null)
    }
  }

  function startEdit(node: TreeNode) {
    setEditing(String(node.id))
    setEditTitle(node.title)
    setError(null)
  }

  async function saveEdit(id: string) {
    if (!editTitle.trim()) {
      setError('Название не может быть пустым')
      return
    }
    setBusy(id)
    try {
      const res = await fetch('/studio/api/categories/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id, title: editTitle.trim() }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || 'Не удалось сохранить')
      } else {
        setEditing(null)
        await refresh()
      }
    } catch {
      setError('Ошибка соединения')
    } finally {
      setBusy(null)
    }
  }

  async function removeCat(node: TreeNode) {
    setError(null)
    const ok = window.confirm(`Удалить категорию «${node.title}»?`)
    if (!ok) return
    setBusy(String(node.id))
    try {
      const res = await fetch('/studio/api/categories/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id: node.id }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || 'Не удалось удалить')
      } else {
        await refresh()
      }
    } catch {
      setError('Ошибка соединения')
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <div className="studio-page-head">
        <div>
          <h1>Категории</h1>
          <div className="studio-page-head__sub">Всего: {cats.length}</div>
        </div>
        <button
          className="studio-btn studio-btn--primary"
          onClick={() => {
            setCreating((v) => !v)
            setError(null)
          }}
        >
          <Plus size={18} />
          Новая категория
        </button>
      </div>

      {error && <div className="studio-login__error" style={{ marginBottom: 'var(--st-space-4)' }}>{error}</div>}

      {/* Форма создания */}
      {creating && (
        <div className="studio-card catmgr__create">
          <div className="catmgr__create-row">
            <input
              className="studio-input"
              placeholder="Название категории"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              autoFocus
            />
            <select
              className="studio-input"
              value={newParent}
              onChange={(e) => setNewParent(e.target.value)}
            >
              <option value="">Корневая (без родителя)</option>
              {cats
                .slice()
                .sort((a, b) => a.title.localeCompare(b.title, 'ru'))
                .map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.title}
                  </option>
                ))}
            </select>
          </div>
          <div className="catmgr__create-actions">
            <button className="studio-btn studio-btn--ghost" onClick={() => setCreating(false)}>
              Отмена
            </button>
            <button
              className="studio-btn studio-btn--primary"
              onClick={createCat}
              disabled={busy === 'create'}
            >
              {busy === 'create' ? <Loader2 size={16} className="spin" /> : null}
              Создать
            </button>
          </div>
        </div>
      )}

      {/* Дерево */}
      {cats.length === 0 ? (
        <div className="studio-empty">
          <div className="studio-empty__icon">
            <FolderTree size={28} />
          </div>
          <div className="studio-empty__title">Категорий пока нет</div>
          <div className="studio-empty__text">Создайте первую, чтобы структурировать публикации.</div>
        </div>
      ) : (
        <div className="catmgr__tree">
          {tree.map((node) => (
            <CatRow
              key={node.id}
              node={node}
              depth={0}
              expanded={expanded}
              onToggle={toggle}
              editing={editing}
              editTitle={editTitle}
              setEditTitle={setEditTitle}
              onStartEdit={startEdit}
              onSaveEdit={saveEdit}
              onCancelEdit={() => setEditing(null)}
              onRemove={removeCat}
              busy={busy}
            />
          ))}
        </div>
      )}
    </>
  )
}

function CatRow({
  node,
  depth,
  expanded,
  onToggle,
  editing,
  editTitle,
  setEditTitle,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onRemove,
  busy,
}: {
  node: TreeNode
  depth: number
  expanded: Set<string>
  onToggle: (id: string) => void
  editing: string | null
  editTitle: string
  setEditTitle: (v: string) => void
  onStartEdit: (n: TreeNode) => void
  onSaveEdit: (id: string) => void
  onCancelEdit: () => void
  onRemove: (n: TreeNode) => void
  busy: string | null
}) {
  const id = String(node.id)
  const hasChildren = node.children.length > 0
  const isOpen = expanded.has(id)
  const isEditing = editing === id
  const isBusy = busy === id

  return (
    <>
      <div className="catmgr__row" style={{ paddingLeft: `calc(var(--st-space-2) + ${depth * 18}px)` }}>
        {hasChildren ? (
          <button className="catmgr__toggle" onClick={() => onToggle(id)}>
            <ChevronRight size={14} className={isOpen ? 'catpick__chev is-open' : 'catpick__chev'} />
          </button>
        ) : (
          <span className="catmgr__toggle catmgr__toggle--empty" />
        )}

        {isEditing ? (
          <div className="catmgr__edit">
            <input
              className="studio-input"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onSaveEdit(id)
                if (e.key === 'Escape') onCancelEdit()
              }}
              autoFocus
            />
            <button className="catmgr__icon-btn catmgr__icon-btn--ok" onClick={() => onSaveEdit(id)} disabled={isBusy} title="Сохранить">
              {isBusy ? <Loader2 size={15} className="spin" /> : <Check size={15} />}
            </button>
            <button className="catmgr__icon-btn" onClick={onCancelEdit} title="Отмена">
              <X size={15} />
            </button>
          </div>
        ) : (
          <>
            <span className="catmgr__title">{node.title}</span>
            <span className="catmgr__slug">/{node.slug}</span>
            {hasChildren && <span className="catmgr__count">{node.children.length}</span>}
            <div className="catmgr__actions">
              <button className="catmgr__icon-btn" onClick={() => onStartEdit(node)} title="Переименовать">
                <Pencil size={15} />
              </button>
              <button
                className="catmgr__icon-btn catmgr__icon-btn--danger"
                onClick={() => onRemove(node)}
                disabled={isBusy}
                title="Удалить"
              >
                {isBusy ? <Loader2 size={15} className="spin" /> : <Trash2 size={15} />}
              </button>
            </div>
          </>
        )}
      </div>

      {hasChildren &&
        isOpen &&
        node.children.map((child) => (
          <CatRow
            key={child.id}
            node={child}
            depth={depth + 1}
            expanded={expanded}
            onToggle={onToggle}
            editing={editing}
            editTitle={editTitle}
            setEditTitle={setEditTitle}
            onStartEdit={onStartEdit}
            onSaveEdit={onSaveEdit}
            onCancelEdit={onCancelEdit}
            onRemove={onRemove}
            busy={busy}
          />
        ))}
    </>
  )
}
