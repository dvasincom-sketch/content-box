'use client'

import React, { useState, useEffect } from 'react'
import { X, Loader2, Check } from 'lucide-react'
import { RichEditor } from '../posts/new/RichEditor'

/**
 * Выдвижная панель редактирования страницы (из конструктора меню).
 * Заголовок + содержимое (RichEditor → HTML → Lexical на сервере).
 * Контент подгружается при открытии через /studio/api/pages/get
 * (Lexical → HTML), сохраняется через /studio/api/pages/update.
 *
 * Структура классов повторяет CategoryEditPanel (catedit__*).
 */
export function PageEditPanel({
  pageId,
  onClose,
  onSaved,
}: {
  pageId: number | string
  onClose: () => void
  onSaved: () => void
}) {
  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState('')
  const [contentHtml, setContentHtml] = useState('')
  const [initialHtml, setInitialHtml] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Загрузка текущего заголовка и содержимого.
  useEffect(() => {
    let stop = false
    setLoading(true)
    setError(null)
    fetch(`/studio/api/pages/get?id=${pageId}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((json) => {
        if (stop) return
        if (json.error) {
          setError(json.error)
        } else {
          setTitle(json.title || '')
          setInitialHtml(json.contentHtml || '')
          setContentHtml(json.contentHtml || '')
        }
      })
      .catch(() => !stop && setError('Не удалось загрузить страницу'))
      .finally(() => !stop && setLoading(false))
    return () => {
      stop = true
    }
  }, [pageId])

  async function save() {
    setError(null)
    if (!title.trim()) {
      setError('Заголовок не может быть пустым')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/studio/api/pages/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          id: pageId,
          title: title.trim(),
          content: contentHtml,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || 'Не удалось сохранить')
        setSaving(false)
        return
      }
      onSaved()
    } catch {
      setError('Ошибка соединения')
      setSaving(false)
    }
  }

  return (
    <div className="catedit__overlay" onClick={onClose}>
      <div className="catedit" onClick={(e) => e.stopPropagation()}>
        <div className="catedit__head">
          <h3>Редактирование страницы</h3>
          <button className="catmgr__icon-btn" onClick={onClose} title="Закрыть">
            <X size={18} />
          </button>
        </div>

        <div className="catedit__body">
          {loading ? (
            <div className="menubld__loading">
              <Loader2 size={18} className="spin" /> Загрузка…
            </div>
          ) : (
            <>
              <div className="studio-field">
                <span className="studio-field__label">Заголовок страницы</span>
                <input
                  className="studio-input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  autoFocus
                />
                <div className="catedit__slug">
                  Это заголовок самой страницы (H1). Название в меню меняется в дереве отдельно.
                </div>
              </div>

              <div className="studio-field">
                <span className="studio-field__label">Содержимое</span>
                <RichEditor
                  initialHtml={initialHtml}
                  onChange={setContentHtml}
                  placeholder="Текст страницы — например, «О проекте»."
                />
              </div>

              {error && <div className="studio-login__error">{error}</div>}
            </>
          )}
        </div>

        <div className="catedit__foot">
          <button className="studio-btn studio-btn--ghost" onClick={onClose}>
            Отмена
          </button>
          <button
            className="studio-btn studio-btn--primary"
            onClick={save}
            disabled={saving || loading}
          >
            {saving ? <Loader2 size={16} className="spin" /> : <Check size={16} />}
            Сохранить
          </button>
        </div>
      </div>
    </div>
  )
}
