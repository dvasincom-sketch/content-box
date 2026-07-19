'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  Loader2, Eye, EyeOff, Pencil, Trash2, Check, X,
  FolderTree, FileText, Link2, AlertCircle,
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

const MAX_DEPTH = 4

/**
 * Конструктор меню (4b-1: каркас без drag-and-drop).
 * Грузит дерево через GET-роут, показывает вложенную структуру,
 * даёт точечные правки: скрыть/показать, переименовать, удалить.
 * Переключатель header/footer.
 */
export function MenuBuilder() {
  const [location, setLocation] = useState<MenuLocation>('header')
  const [tree, setTree] = useState<AdminMenuNode[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyKey, setBusyKey] = useState<string | null>(null)

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

  // --- Операции --------------------------------------------------------------

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
              busyKey={busyKey}
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
  busyKey,
  onToggleHidden,
  onRename,
  onRemove,
}: {
  node: AdminMenuNode
  depth: number
  busyKey: string | null
  onToggleHidden: (n: AdminMenuNode) => void
  onRename: (n: AdminMenuNode, label: string) => Promise<boolean>
  onRemove: (n: AdminMenuNode) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(node.label)
  const busy = busyKey === node.key

  const KindIcon =
    node.kind === 'category' ? FolderTree : node.kind === 'page' ? FileText : Link2

  async function saveRename() {
    const ok = await onRename(node, draft)
    if (ok) setEditing(false)
  }

  return (
    <li className="menubld__node">
      <div
        className={`menubld__row${node.isHidden ? ' is-hidden' : ''}`}
        style={{ paddingLeft: `${(depth - 1) * 22 + 10}px` }}
      >
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
              busyKey={busyKey}
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
