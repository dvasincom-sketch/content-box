'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  Loader2, Eye, EyeOff, Pencil, Trash2, Check, X,
  FolderTree, FileText, Link2, AlertCircle, GripVertical,
} from 'lucide-react'

/** Узел дерева, как его отдаёт GET /studio/api/menu (buildMenuAdmin). */
type AdminMenuNode = {
  key: string
  kind: 'category' | 'page' | 'url'
  label: string
  originalLabel: string
  href: string
  categoryId: number | null
  pageId: number | null
  overrideId: number | null
  isHidden: boolean
  isManual: boolean
  children: AdminMenuNode[]
}

type MenuLocation = 'header' | 'footer'

/** Активное перетаскивание: ключ узла и ключ его родителя (для проверки сиблингов). */
type DragState = { key: string; parentKey: string | null } | null

/**
 * Конструктор меню (4b-2: каркас + drag-and-drop внутри уровня).
 * Перетаскивание разрешено только между узлами одного родителя (сиблингами).
 * Смена родителя ручных пунктов — через форму (4b-3), не через dnd.
 */
export function MenuBuilder() {
  const [location, setLocation] = useState<MenuLocation>('header')
  const [tree, setTree] = useState<AdminMenuNode[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [drag, setDrag] = useState<DragState>(null)
  const [savingOrder, setSavingOrder] = useState(false)

  const load = useCallback(async (loc: MenuLocation) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/studio/api/menu?location=${loc}`, {
        credentials: 'include',
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || 'Не удалось загрузить меню')
        setTree([])
      } else {
        setTree(Array.isArray(json.tree) ? json.tree : [])
      }
    } catch {
      setError('Ошибка соединения')
      setTree([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(location)
  }, [location, load])

  // --- Точечные операции -----------------------------------------------------

  const toggleHidden = useCallback(
    async (node: AdminMenuNode) => {
      setBusyKey(node.key)
      setError(null)
      try {
        const nextHidden = !node.isHidden
        let res: Response
        if (node.isManual) {
          res = await fetch('/studio/api/menu/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ id: node.overrideId, hidden: nextHidden }),
          })
        } else {
          res = await fetch('/studio/api/menu/upsert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              location,
              categoryId: node.categoryId,
              hidden: nextHidden,
            }),
          })
        }
        const json = await res.json()
        if (!res.ok) setError(json.error || 'Не удалось изменить видимость')
        else await load(location)
      } catch {
        setError('Ошибка соединения')
      } finally {
        setBusyKey(null)
      }
    },
    [location, load],
  )

  const rename = useCallback(
    async (node: AdminMenuNode, nextLabel: string) => {
      setBusyKey(node.key)
      setError(null)
      const trimmed = nextLabel.trim()
      try {
        let res: Response
        if (node.isManual) {
          res = await fetch('/studio/api/menu/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ id: node.overrideId, labelOverride: trimmed }),
          })
        } else {
          res = await fetch('/studio/api/menu/upsert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              location,
              categoryId: node.categoryId,
              labelOverride: trimmed,
            }),
          })
        }
        const json = await res.json()
        if (!res.ok) {
          setError(json.error || 'Не удалось переименовать')
          return false
        }
        await load(location)
        return true
      } catch {
        setError('Ошибка соединения')
        return false
      } finally {
        setBusyKey(null)
      }
    },
    [location, load],
  )

  const remove = useCallback(
    async (node: AdminMenuNode) => {
      const childCount = countDescendants(node)
      const msg = node.isManual
        ? childCount > 0
          ? `Удалить пункт «${node.label}» и вложенные (${childCount})?`
          : `Удалить пункт «${node.label}»?`
        : `Вернуть «${node.label}» в автоматический вид? Ручные настройки этого пункта${
            childCount > 0 ? ` и вложенные (${childCount})` : ''
          } будут удалены.`
      if (!window.confirm(msg)) return

      setBusyKey(node.key)
      setError(null)
      try {
        const res = await fetch('/studio/api/menu/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ key: node.key }),
        })
        const json = await res.json()
        if (!res.ok) setError(json.error || 'Не удалось удалить')
        else await load(location)
      } catch {
        setError('Ошибка соединения')
      } finally {
        setBusyKey(null)
      }
    },
    [location, load],
  )

  // --- Drag-and-drop: reorder внутри уровня ----------------------------------

  /**
   * Дроп узла `dragged` на позицию узла `target`. Разрешён только когда у обоих
   * один родитель (сиблинги). Пересобираем порядок уровня и шлём в reorder.
   */
  const dropOnto = useCallback(
    async (
      target: AdminMenuNode,
      targetParentKey: string | null,
      siblings: AdminMenuNode[],
    ) => {
      const d = drag
      setDrag(null)
      if (!d) return
      if (d.key === target.key) return
      // Только внутри одного уровня.
      if (d.parentKey !== targetParentKey) {
        setError('Переместить можно только внутри одного уровня')
        return
      }

      const fromIdx = siblings.findIndex((n) => n.key === d.key)
      const toIdx = siblings.findIndex((n) => n.key === target.key)
      if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return

      const reordered = [...siblings]
      const [moved] = reordered.splice(fromIdx, 1)
      reordered.splice(toIdx, 0, moved)

      // Новый порядок для всех сиблингов уровня.
      const ops = reordered.map((n, i) => ({
        key: n.key,
        order: i,
        parentKey: targetParentKey,
      }))

      setSavingOrder(true)
      setError(null)
      try {
        const res = await fetch('/studio/api/menu/reorder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ location, ops }),
        })
        const json = await res.json()
        if (!res.ok) setError(json.error || 'Не удалось сохранить порядок')
        await load(location)
      } catch {
        setError('Ошибка соединения')
        await load(location)
      } finally {
        setSavingOrder(false)
      }
    },
    [drag, location, load],
  )

  // --- Рендер ----------------------------------------------------------------

  return (
    <div className="menubld">
      <div className="menubld__tabs">
        <button
          className={`menubld__tab${location === 'header' ? ' is-active' : ''}`}
          onClick={() => setLocation('header')}
          type="button"
        >
          Меню (шапка)
        </button>
        <button
          className={`menubld__tab${location === 'footer' ? ' is-active' : ''}`}
          onClick={() => setLocation('footer')}
          type="button"
        >
          Футер
        </button>
        {savingOrder && (
          <span className="menubld__saving">
            <Loader2 size={13} className="spin" /> сохранение…
          </span>
        )}
      </div>

      {error && (
        <div className="menubld__error">
          <AlertCircle size={15} /> {error}
        </div>
      )}

      {loading ? (
        <div className="menubld__loading">
          <Loader2 size={18} className="spin" /> Загрузка…
        </div>
      ) : tree.length === 0 ? (
        <div className="menubld__empty">
          Пунктов пока нет. Отметьте категории флагом «В меню/футере» или добавьте пункт вручную.
        </div>
      ) : (
        <ul className="menubld__tree">
          {tree.map((node) => (
            <MenuRow
              key={node.key}
              node={node}
              depth={1}
              parentKey={null}
              siblings={tree}
              busyKey={busyKey}
              drag={drag}
              onDragStart={setDrag}
              onDragEnd={() => setDrag(null)}
              onDrop={dropOnto}
              onToggleHidden={toggleHidden}
              onRename={rename}
              onRemove={remove}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

/** Одна строка дерева + рекурсивные дети. */
function MenuRow({
  node,
  depth,
  parentKey,
  siblings,
  busyKey,
  drag,
  onDragStart,
  onDragEnd,
  onDrop,
  onToggleHidden,
  onRename,
  onRemove,
}: {
  node: AdminMenuNode
  depth: number
  parentKey: string | null
  siblings: AdminMenuNode[]
  busyKey: string | null
  drag: DragState
  onDragStart: (d: DragState) => void
  onDragEnd: () => void
  onDrop: (
    target: AdminMenuNode,
    targetParentKey: string | null,
    siblings: AdminMenuNode[],
  ) => void
  onToggleHidden: (n: AdminMenuNode) => void
  onRename: (n: AdminMenuNode, label: string) => Promise<boolean>
  onRemove: (n: AdminMenuNode) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(node.label)
  const busy = busyKey === node.key

  const KindIcon =
    node.kind === 'category' ? FolderTree : node.kind === 'page' ? FileText : Link2

  const isDragging = drag?.key === node.key
  // Цель приемлема для дропа, если тащат сиблинга (тот же родитель) и не сам себя.
  const isDropTarget =
    drag != null && drag.parentKey === parentKey && drag.key !== node.key

  async function saveRename() {
    const ok = await onRename(node, draft)
    if (ok) setEditing(false)
  }

  return (
    <li className="menubld__node">
      <div
        className={
          'menubld__row' +
          (node.isHidden ? ' is-hidden' : '') +
          (isDragging ? ' is-dragging' : '') +
          (isDropTarget ? ' is-dropzone' : '')
        }
        style={{ paddingLeft: `${(depth - 1) * 22 + 10}px` }}
        onDragOver={(e) => {
          if (isDropTarget) e.preventDefault() // разрешить drop только сиблингам
        }}
        onDrop={(e) => {
          e.preventDefault()
          onDrop(node, parentKey, siblings)
        }}
      >
        <span
          className="menubld__grip"
          title="Перетащите для порядка"
          draggable={!editing}
          onDragStart={() => onDragStart({ key: node.key, parentKey })}
          onDragEnd={onDragEnd}
        >
          <GripVertical size={14} />
        </span>

        <span className="menubld__kind" title={kindTitle(node.kind)}>
          <KindIcon size={15} />
        </span>

        {editing ? (
          <div className="menubld__edit">
            <input
              className="studio-input menubld__edit-input"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={node.originalLabel}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveRename()
                if (e.key === 'Escape') {
                  setDraft(node.label)
                  setEditing(false)
                }
              }}
            />
            <button
              className="catmgr__icon-btn"
              onClick={saveRename}
              disabled={busy}
              title="Сохранить"
            >
              {busy ? <Loader2 size={14} className="spin" /> : <Check size={14} />}
            </button>
            <button
              className="catmgr__icon-btn"
              onClick={() => {
                setDraft(node.label)
                setEditing(false)
              }}
              title="Отмена"
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <>
            <span className="menubld__label">{node.label}</span>
            <span className="menubld__href" title={node.href}>
              {node.href}
            </span>

            <div className="menubld__actions">
              <button
                className="catmgr__icon-btn"
                onClick={() => onToggleHidden(node)}
                disabled={busy}
                title={node.isHidden ? 'Показать' : 'Скрыть'}
              >
                {busy ? (
                  <Loader2 size={14} className="spin" />
                ) : node.isHidden ? (
                  <EyeOff size={14} />
                ) : (
                  <Eye size={14} />
                )}
              </button>
              <button
                className="catmgr__icon-btn"
                onClick={() => {
                  setDraft(node.label)
                  setEditing(true)
                }}
                disabled={busy}
                title="Переименовать"
              >
                <Pencil size={14} />
              </button>
              <button
                className="catmgr__icon-btn menubld__del"
                onClick={() => onRemove(node)}
                disabled={busy}
                title={node.isManual ? 'Удалить' : 'Сбросить к автоматическому'}
              >
                <Trash2 size={14} />
              </button>
            </div>
          </>
        )}
      </div>

      {node.children.length > 0 && (
        <ul className="menubld__children">
          {node.children.map((child) => (
            <MenuRow
              key={child.key}
              node={child}
              depth={depth + 1}
              parentKey={node.key}
              siblings={node.children}
              busyKey={busyKey}
              drag={drag}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onDrop={onDrop}
              onToggleHidden={onToggleHidden}
              onRename={onRename}
              onRemove={onRemove}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

function kindTitle(kind: AdminMenuNode['kind']): string {
  if (kind === 'category') return 'Категория'
  if (kind === 'page') return 'Страница'
  return 'Внешняя ссылка'
}

function countDescendants(node: AdminMenuNode): number {
  let n = 0
  for (const c of node.children) n += 1 + countDescendants(c)
  return n
}
