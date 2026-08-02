'use client'

import React, { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, ChevronDown } from 'lucide-react'
import { TiptapEditor } from '@/app/(studio)/studio/(app)/posts/new/TiptapEditor'
import { createSubmission } from './actions'

type Cat = { id: number; title: string; parentId: number | null }

/** DFS-порядок дерева категорий + глубина (для отступов). Сироты (родитель
 *  отсутствует в списке) считаются корнями, чтобы ничего не потерялось. */
function flattenTree(cats: Cat[]): { cat: Cat; depth: number }[] {
  const present = new Set(cats.map((c) => c.id))
  const byParent = new Map<number | null, Cat[]>()
  for (const c of cats) {
    const pid = c.parentId != null && present.has(c.parentId) ? c.parentId : null
    if (!byParent.has(pid)) byParent.set(pid, [])
    byParent.get(pid)!.push(c)
  }
  for (const list of byParent.values()) list.sort((a, b) => a.title.localeCompare(b.title, 'ru'))
  const out: { cat: Cat; depth: number }[] = []
  const walk = (parent: number | null, depth: number) => {
    for (const c of byParent.get(parent) ?? []) {
      out.push({ cat: c, depth })
      walk(c.id, depth + 1)
    }
  }
  walk(null, 0)
  return out
}

/** Иерархический выбор категории в бренд-стиле (триггер .c-input + .c-popover).
 *  Отступ показывает уровень вложенности; выбрать можно любую категорию. */
function CategoryPicker({
  items,
  value,
  onChange,
}: {
  items: { cat: Cat; depth: number }[]
  value: string
  onChange: (v: string) => void
}) {
  const [open, setOpen] = useState(false)
  const selected = items.find((i) => String(i.cat.id) === value)?.cat

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        className="c-input"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', textAlign: 'left', cursor: 'pointer' }}
      >
        <span style={{ color: selected ? 'var(--brand-text)' : 'var(--brand-muted)' }}>
          {selected ? selected.title : 'Выберите категорию'}
        </span>
        <ChevronDown size={16} style={{ color: 'var(--brand-muted)', flex: 'none', transition: 'transform .15s', transform: open ? 'rotate(180deg)' : 'none' }} />
      </button>

      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setOpen(false)} />
          <ul
            className="c-popover"
            role="listbox"
            style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 50, maxHeight: 300, overflowY: 'auto', margin: 0, listStyle: 'none' }}
          >
            <li>
              <button
                type="button"
                className={`c-popover__item${value === '' ? ' is-active' : ''}`}
                onClick={() => { onChange(''); setOpen(false) }}
                style={{ justifyContent: 'flex-start', color: 'var(--brand-muted)' }}
              >
                Без категории
              </button>
            </li>
            {items.map(({ cat, depth }) => (
              <li key={cat.id}>
                <button
                  type="button"
                  className={`c-popover__item${value === String(cat.id) ? ' is-active' : ''}`}
                  onClick={() => { onChange(String(cat.id)); setOpen(false) }}
                  style={{ justifyContent: 'flex-start', paddingLeft: 12 + depth * 18 }}
                >
                  {depth > 0 && (
                    <span aria-hidden style={{ color: 'var(--brand-muted)', marginRight: 8 }}>└</span>
                  )}
                  <span>{cat.title}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

/**
 * Форма отправки публикации участником. Тот же редактор, что в Студии
 * (Tiptap) → HTML → сервер конвертирует в Lexical. Картинки выключены: их
 * загрузка идёт в роут студии и требует сессии автора. Trusted (L4) публикует
 * сразу; остальные — на модерацию.
 */
export function SubmitForm({ categories }: { categories: Cat[] }) {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [bodyHtml, setBodyHtml] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const tree = useMemo(() => flattenTree(categories), [categories])

  async function submit() {
    setError(null)
    if (!title.trim()) {
      setError('Укажите заголовок.')
      return
    }
    setBusy(true)
    try {
      const res = await createSubmission({ title, bodyHtml, categoryId: categoryId || null })
      if (!res.ok) {
        setError(res.error)
      } else if (res.status === 'published' && res.slug) {
        router.push(`/publication/${res.slug}`)
      } else {
        setPending(true)
      }
    } catch {
      setError('Ошибка соединения.')
    } finally {
      setBusy(false)
    }
  }

  if (pending) {
    return (
      <div className="c-card" style={{ padding: 28 }}>
        <h1 style={{ fontSize: 24, color: 'var(--brand-text)', marginBottom: 8 }}>Отправлено на модерацию</h1>
        <p style={{ color: 'var(--brand-muted)' }}>
          Публикация появится после проверки редактором. Спасибо за вклад в сообщество!
        </p>
      </div>
    )
  }

  return (
    <>
      <h1 style={{ fontSize: 28, color: 'var(--brand-text)', marginBottom: 6 }}>Новая публикация</h1>
      <p style={{ color: 'var(--brand-muted)', marginBottom: 20 }}>
        Материал участника. После проверки редактором он выйдет с вашей подписью.
      </p>

      <div className="c-card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <input
          className="c-input"
          placeholder="Заголовок"
          value={title}
          maxLength={160}
          onChange={(e) => setTitle(e.target.value)}
        />
        <TiptapEditor onChange={setBodyHtml} placeholder="Текст публикации…" allowImages={false} />
        {tree.length > 0 && (
          <div className="c-field">
            <span className="c-field__label">Категория</span>
            <CategoryPicker items={tree} value={categoryId} onChange={setCategoryId} />
          </div>
        )}
        {error && <div style={{ color: 'var(--danger)', fontSize: 14 }}>{error}</div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button className="c-btn c-btn--primary" onClick={submit} disabled={busy}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : null} Опубликовать
          </button>
        </div>
      </div>
    </>
  )
}
