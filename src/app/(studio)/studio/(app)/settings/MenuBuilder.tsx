'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Loader2, Eye, EyeOff, Pencil, Trash2, Check, X,
  FolderTree, FileText, Link2, AlertCircle, GripVertical,
  Plus, FolderInput, FileEdit,
} from 'lucide-react'
import { StudioSelect } from '../_ui/StudioSelect'
import { PageEditPanel } from './PageEditPanel'

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

type PageOption = { id: number | string; title: string; slug: string }
type MenuLocation = 'header' | 'footer'

/** Активное перетаскивание: ключ узла и ключ его родителя (для проверки сиблингов). */
type DragState = { key: string; parentKey: string | null } | null

const MAX_DEPTH = 4

/** Плоский пункт для выбора родителя: ключ, подпись, глубина. */
type FlatOption = { key: string; label: string; depth: number }

/**
 * Конструктор меню (4b-3: каркас + dnd + добавление пунктов и смена родителя).
 * Категории подтягиваются автоматически; ручные пункты (страница/URL) можно
 * добавлять, переименовывать, перемещать между уровнями через форму.
 */
export function MenuBuilder() {
  const [location, setLocation] = useState<MenuLocation>('header')
  const [tree, setTree] = useState<AdminMenuNode[]>([])
  const [pages, setPages] = useState<PageOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [drag, setDrag] = useState<DragState>(null)
  const [savingOrder, setSavingOrder] = useState(false)
  const [adding, setAdding] = useState(false)
  const [moveFor, setMoveFor] = useState<AdminMenuNode | null>(null)
  const [editPage, setEditPage] = useState<{ id: number | string } | null>(null)

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
        setPages([])
      } else {
        setTree(Array.isArray(json.tree) ? json.tree : [])
        setPages(Array.isArray(json.pages) ? json.pages : [])
      }
    } catch {
      setError('Ошибка соединения')
      setTree([])
      setPages([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(location)
  }, [location, load])

  // Плоский список узлов для выбора родителя (с отступами по глубине).
  // Исключаем узлы на MAX_DEPTH уровне — под них нельзя вкладывать.
  const parentOptions = useMemo<FlatOption[]>(() => {
    const out: FlatOption[] = []
    const walk = (nodes: AdminMenuNode[], depth: number) => {
      for (const n of nodes) {
        if (depth < MAX_DEPTH) out.push({ key: n.key, label: n.label, depth })
        walk(n.children, depth + 1)
      }
    }
    walk(tree, 1)
    return out
  }, [tree])

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

  // --- Смена родителя ручного пункта (через форму) ---------------------------

  const moveToParent = useCallback(
    async (node: AdminMenuNode, newParentKey: string | null) => {
      setBusyKey(node.key)
      setError(null)
      try {
        const res = await fetch('/studio/api/menu/reorder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            location,
            ops: [{ key: node.key, order: 9999, parentKey: newParentKey }],
          }),
        })
        const json = await res.json()
        if (!res.ok) setError(json.error || 'Не удалось переместить')
        else await load(location)
      } catch {
        setError('Ошибка соединения')
      } finally {
        setBusyKey(null)
        setMoveFor(null)
      }
    },
    [location, load],
  )

  // --- Создание ручного пункта -----------------------------------------------

  const createItem = useCallback(
    async (payload: {
      kind: 'page' | 'url'
      pageId?: number | string
      url?: string
      labelOverride?: string
      parentKey: string | null
    }) => {
      setError(null)
      const parent = keyToParentRef(payload.parentKey)
      const body: any = {
        location,
        kind: payload.kind,
        ...parent,
      }
      if (payload.kind === 'page') body.pageId = payload.pageId
      else body.url = payload.url
      if (payload.labelOverride) body.labelOverride = payload.labelOverride

      try {
        const res = await fetch('/studio/api/menu/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(body),
        })
        const json = await res.json()
        if (!res.ok) {
          setError(json.error || 'Не удалось добавить пункт')
          return false
        }
        await load(location)
        return true
      } catch {
        setError('Ошибка соединения')
        return false
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
        {savingOrder && (
          <span className="menubld__saving">
            <Loader2 size={13} className="spin" /> сохранение…
          </span>
        )}
        <button
          className="studio-btn studio-btn--ghost menubld__add-btn"
          onClick={() => setAdding((v) => !v)}
          type="button"
        >
          <Plus size={15} /> Добавить пункт
        </button>
      </div>

      {adding && (
        <AddItemForm
          pages={pages}
          parentOptions={parentOptions}
          onCancel={() => setAdding(false)}
          onCreate={async (payload) => {
            const ok = await createItem(payload)
            if (ok) setAdding(false)
          }}
        />
      )}

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
              onMove={setMoveFor}
              onEditPage={(id) => setEditPage({ id })}
            />
          ))}
        </ul>
      )}

      {moveFor && (
        <MoveDialog
          node={moveFor}
          parentOptions={parentOptions.filter(
            (o) => o.key !== moveFor.key && !isDescendantKey(moveFor, o.key),
          )}
          onCancel={() => setMoveFor(null)}
          onMove={(parentKey) => moveToParent(moveFor, parentKey)}
        />
      )}

      {editPage && (
        <PageEditPanel
          pageId={editPage.id}
          onClose={() => setEditPage(null)}
          onSaved={() => {
            setEditPage(null)
            load(location)
          }}
        />
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
  onMove,
  onEditPage,
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
  onMove: (n: AdminMenuNode) => void
  onEditPage: (id: number | string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(node.label)
  const busy = busyKey === node.key

  const KindIcon =
    node.kind === 'category' ? FolderTree : node.kind === 'page' ? FileText : Link2

  const isDragging = drag?.key === node.key
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
          if (isDropTarget) e.preventDefault()
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
              {node.isManual && (
                <button
                  className="catmgr__icon-btn"
                  onClick={() => onMove(node)}
                  disabled={busy}
                  title="Переместить"
                >
                  <FolderInput size={14} />
                </button>
              )}
              {node.kind === 'page' && node.pageId != null && (
                <button
                  className="catmgr__icon-btn"
                  onClick={() => onEditPage(node.pageId as number | string)}
                  disabled={busy}
                  title="Редактировать содержимое страницы"
                >
                  <FileEdit size={14} />
                </button>
              )}
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
              onMove={onMove}
              onEditPage={onEditPage}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

/** Форма добавления ручного пункта (страница / внешний URL). */
function AddItemForm({
  pages,
  parentOptions,
  onCancel,
  onCreate,
}: {
  pages: PageOption[]
  parentOptions: FlatOption[]
  onCancel: () => void
  onCreate: (payload: {
    kind: 'page' | 'url'
    pageId?: number | string
    url?: string
    labelOverride?: string
    parentKey: string | null
  }) => void
}) {
  const [kind, setKind] = useState<'page' | 'url'>('page')
  const [pageId, setPageId] = useState<string>(pages[0] ? String(pages[0].id) : '')
  const [url, setUrl] = useState('')
  const [label, setLabel] = useState('')
  const [parentKey, setParentKey] = useState<string>('__root__')
  const [busy, setBusy] = useState(false)

  async function submit() {
    setBusy(true)
    await onCreate({
      kind,
      pageId: kind === 'page' ? pageId : undefined,
      url: kind === 'url' ? url.trim() : undefined,
      labelOverride: label.trim() || undefined,
      parentKey: parentKey === '__root__' ? null : parentKey,
    })
    setBusy(false)
  }

  const canSubmit =
    kind === 'page' ? Boolean(pageId) : Boolean(url.trim()) && Boolean(label.trim())

  return (
    <div className="menubld__addform">
      <div className="menubld__addform-row">
        <StudioSelect
          value={kind}
          onChange={(v) => setKind(v as 'page' | 'url')}
          options={[
            { value: 'page', label: 'Страница' },
            { value: 'url', label: 'Внешняя ссылка' },
          ]}
          ariaLabel="Тип пункта"
        />

        {kind === 'page' ? (
          <StudioSelect
            value={pageId}
            onChange={setPageId}
            options={pages.map((p) => ({ value: String(p.id), label: p.title }))}
            ariaLabel="Страница"
          />
        ) : (
          <>
            <input
              className="studio-input"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…"
            />
            <input
              className="studio-input"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Название"
            />
          </>
        )}
      </div>

      <div className="menubld__addform-row">
        <span className="menubld__addform-label">Родитель:</span>
        <StudioSelect
          value={parentKey}
          onChange={setParentKey}
          options={[
            { value: '__root__', label: 'Верхний уровень' },
            ...parentOptions.map((o) => ({
              value: o.key,
              label: o.label,
              depth: o.depth,
            })),
          ]}
          ariaLabel="Родительский пункт"
        />
        {kind === 'page' && (
          <input
            className="studio-input"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Название (по умолчанию — имя страницы)"
          />
        )}
      </div>

      <div className="menubld__addform-actions">
        <button className="studio-btn studio-btn--ghost" onClick={onCancel} disabled={busy}>
          Отмена
        </button>
        <button
          className="studio-btn studio-btn--primary"
          onClick={submit}
          disabled={busy || !canSubmit}
        >
          {busy ? <Loader2 size={15} className="spin" /> : <Plus size={15} />}
          Добавить
        </button>
      </div>
    </div>
  )
}

/** Диалог смены родителя ручного пункта. */
function MoveDialog({
  node,
  parentOptions,
  onCancel,
  onMove,
}: {
  node: AdminMenuNode
  parentOptions: FlatOption[]
  onCancel: () => void
  onMove: (parentKey: string | null) => void
}) {
  const [parentKey, setParentKey] = useState<string>('__root__')

  return (
    <div className="menubld__movedlg-overlay" onClick={onCancel}>
      <div className="menubld__movedlg" onClick={(e) => e.stopPropagation()}>
        <div className="menubld__movedlg-head">
          <span>Переместить «{node.label}»</span>
          <button className="catmgr__icon-btn" onClick={onCancel} title="Закрыть">
            <X size={16} />
          </button>
        </div>
        <div className="menubld__movedlg-body">
          <span className="menubld__addform-label">Новый родитель:</span>
          <StudioSelect
            value={parentKey}
            onChange={setParentKey}
            options={[
              { value: '__root__', label: 'Верхний уровень' },
              ...parentOptions.map((o) => ({
                value: o.key,
                label: o.label,
                depth: o.depth,
              })),
            ]}
            ariaLabel="Новый родитель"
          />
        </div>
        <div className="menubld__addform-actions">
          <button className="studio-btn studio-btn--ghost" onClick={onCancel}>
            Отмена
          </button>
          <button
            className="studio-btn studio-btn--primary"
            onClick={() => onMove(parentKey === '__root__' ? null : parentKey)}
          >
            <Check size={15} /> Переместить
          </button>
        </div>
      </div>
    </div>
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

/** Является ли key потомком node (чтобы не дать переместить пункт под своего же потомка). */
function isDescendantKey(node: AdminMenuNode, key: string): boolean {
  for (const c of node.children) {
    if (c.key === key) return true
    if (isDescendantKey(c, key)) return true
  }
  return false
}

/**
 * Ключ родителя из формы → поля для роута create.
 *   'item:34'  → { parentId: 34 }        (ручной пункт-родитель)
 *   'cat:12'   → { parentCategoryId: 12 } (категория; бэк материализует оверрайд)
 *   null       → {}                        (корневой уровень)
 */
function keyToParentRef(
  key: string | null,
): { parentId?: number } | { parentCategoryId?: number } | Record<string, never> {
  if (!key) return {}
  const [type, raw] = key.split(':')
  const id = Number(raw)
  if (!Number.isFinite(id)) return {}
  if (type === 'item') return { parentId: id }
  if (type === 'cat') return { parentCategoryId: id }
  return {}
}
