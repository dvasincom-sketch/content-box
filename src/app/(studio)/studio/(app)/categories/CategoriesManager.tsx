'use client'

import React, { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronRight, Plus, Pencil, Trash2, Loader2, FolderTree, Image as ImageIcon } from 'lucide-react'
import { CategoryEditPanel, type EditableCat } from './CategoryEditPanel'
import { StudioSelect } from '../_ui/StudioSelect'

type Cat = {
  id: number | string
  title: string
  slug: string
  parentId: number | string | null
  descriptionHtml: string
  coverId: number | null
  coverUrl: string | null
  posterLayout: boolean
}
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
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [editingCat, setEditingCat] = useState<EditableCat | null>(null)

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

  function refresh() {
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
      if (!res.ok) setError(json.error || 'Не удалось создать')
      else {
        setNewTitle('')
        setNewParent('')
        setCreating(false)
        refresh()
      }
    } catch {
      setError('Ошибка соединения')
    } finally {
      setBusy(null)
    }
  }

  function openEdit(node: TreeNode) {
    setEditingCat({
      id: node.id,
      title: node.title,
      slug: node.slug,
      descriptionHtml: node.descriptionHtml,
      coverId: node.coverId,
      coverUrl: node.coverUrl,
      posterLayout: node.posterLayout,
    })
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
      if (!res.ok) setError(json.error || 'Не удалось удалить')
      else refresh()
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
            <StudioSelect
              value={newParent}
              onChange={setNewParent}
              options={[
                { value: '', label: 'Корневая (без родителя)' },
                ...cats
                  .slice()
                  .sort((a, b) => a.title.localeCompare(b.title, 'ru'))
                  .map((c) => ({ value: String(c.id), label: c.title })),
              ]}
              ariaLabel="Родительская категория"
            />
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
              onEdit={openEdit}
              onRemove={removeCat}
              busy={busy}
            />
          ))}
        </div>
      )}

      {editingCat && (
        <CategoryEditPanel
          cat={editingCat}
          onClose={() => setEditingCat(null)}
          onSaved={() => {
            setEditingCat(null)
            refresh()
          }}
        />
      )}
    </>
  )
}

function CatRow({
  node,
  depth,
  expanded,
  onToggle,
  onEdit,
  onRemove,
  busy,
}: {
  node: TreeNode
  depth: number
  expanded: Set<string>
  onToggle: (id: string) => void
  onEdit: (n: TreeNode) => void
  onRemove: (n: TreeNode) => void
  busy: string | null
}) {
  const id = String(node.id)
  const hasChildren = node.children.length > 0
  const isOpen = expanded.has(id)
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

        {node.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={node.coverUrl} alt="" className="catmgr__thumb" />
        ) : (
          <span className="catmgr__thumb catmgr__thumb--empty" aria-hidden>
            <ImageIcon size={12} />
          </span>
        )}

        <span className="catmgr__title">{node.title}</span>
        <span className="catmgr__slug">/{node.slug}</span>
        {hasChildren && <span className="catmgr__count">{node.children.length}</span>}
        <div className="catmgr__actions">
          <button className="catmgr__icon-btn" onClick={() => onEdit(node)} title="Редактировать">
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
            onEdit={onEdit}
            onRemove={onRemove}
            busy={busy}
          />
        ))}
    </>
  )
}
