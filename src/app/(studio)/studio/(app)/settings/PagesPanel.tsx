'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { Plus, Loader2, Pencil, FileText, Trash2 } from 'lucide-react'
import { PageEditPanel } from './PageEditPanel'
import { ConfirmDialog } from '../_ui/ConfirmDialog'

type PageRow = { id: number; title: string; slug: string }

/**
 * Панель «Страницы» в настройках: список страниц тенанта + создание новой.
 * Создание — только заголовок (slug генерится на сервере); сразу открываем
 * PageEditPanel для наполнения содержимым. Редактирование — тот же PageEditPanel.
 */
export function PagesPanel() {
  const [pages, setPages] = useState<PageRow[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editId, setEditId] = useState<number | string | null>(null)
  const [confirmDel, setConfirmDel] = useState<PageRow | null>(null)
  const [delBusy, setDelBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/studio/api/pages/list', { credentials: 'include' })
      const j = await r.json()
      setPages(Array.isArray(j.pages) ? j.pages : [])
    } catch {
      setError('Не удалось загрузить страницы')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function create() {
    const t = newTitle.trim()
    if (!t) return
    setBusy(true)
    setError(null)
    try {
      const r = await fetch('/studio/api/pages/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ title: t }),
      })
      const j = await r.json()
      if (!r.ok) {
        setError(j.error || 'Не удалось создать')
        setBusy(false)
        return
      }
      setNewTitle('')
      setCreating(false)
      await load()
      setEditId(j.id)
    } catch {
      setError('Ошибка соединения')
    } finally {
      setBusy(false)
    }
  }

  async function doDelete(p: PageRow) {
    setDelBusy(true)
    setError(null)
    try {
      const r = await fetch('/studio/api/pages/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id: p.id }),
      })
      const j = await r.json()
      if (!r.ok) setError(j.error || 'Не удалось удалить')
      setConfirmDel(null)
      await load()
    } catch {
      setError('Ошибка соединения')
    } finally {
      setDelBusy(false)
    }
  }

  return (
    <div className="menubld">
      <div className="menubld__tabs">
        <button
          className="studio-btn studio-btn--ghost menubld__add-btn"
          type="button"
          onClick={() => setCreating((v) => !v)}
        >
          <Plus size={15} /> Создать страницу
        </button>
      </div>

      {creating && (
        <div className="studio-field" style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <input
            className="studio-input"
            placeholder="Заголовок страницы — например, «О проекте»"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') create()
            }}
            autoFocus
          />
          <button
            className="studio-btn studio-btn--primary"
            onClick={create}
            disabled={busy || !newTitle.trim()}
          >
            {busy ? <Loader2 size={16} className="spin" /> : 'Создать'}
          </button>
        </div>
      )}

      {error && <div className="menubld__error">{error}</div>}

      {loading ? (
        <div className="menubld__loading">
          <Loader2 size={18} className="spin" /> Загрузка…
        </div>
      ) : pages.length === 0 ? (
        <div className="menubld__empty">
          Страниц пока нет. Создайте первую — например, «О проекте» или «Правила».
        </div>
      ) : (
        <ul className="menubld__tree">
          {pages.map((p) => (
            <li
              key={p.id}
              className="menubld__row"
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 4px' }}
            >
              <FileText size={16} style={{ opacity: 0.55, flexShrink: 0 }} />
              <span style={{ flex: 1, minWidth: 0 }}>
                {p.title}{' '}
                <span style={{ opacity: 0.5, fontSize: 13 }}>/page/{p.slug}</span>
              </span>
              <button
                className="catmgr__icon-btn"
                title="Редактировать содержимое"
                onClick={() => setEditId(p.id)}
              >
                <Pencil size={16} />
              </button>
              <button
                className="catmgr__icon-btn catmgr__icon-btn--danger"
                title="Удалить страницу"
                onClick={() => setConfirmDel(p)}
              >
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {editId != null && (
        <PageEditPanel
          pageId={editId}
          onClose={() => setEditId(null)}
          onSaved={() => {
            setEditId(null)
            load()
          }}
        />
      )}

      {confirmDel && (
        <ConfirmDialog
          title="Удалить страницу?"
          message={'Страница «' + confirmDel.title + '» будет удалена без возможности восстановления. Пункты меню, ссылающиеся на неё, тоже удалятся.'}
          confirmLabel={delBusy ? 'Удаление…' : 'Удалить'}
          cancelLabel="Отмена"
          danger
          onConfirm={() => doDelete(confirmDel)}
          onCancel={() => setConfirmDel(null)}
        />
      )}
    </div>
  )
}
