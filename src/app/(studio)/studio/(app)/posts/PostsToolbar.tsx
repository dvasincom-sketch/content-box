'use client'

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Search, X, ArrowDownWideNarrow, ArrowUpNarrowWide, ChevronDown, ListFilter } from 'lucide-react'
import { CategoryMultiPicker, type CatItem } from '../settings/CategoryMultiPicker'

/**
 * Панель ленты публикаций студии в одну строку: быстрый поиск по названию
 * (дебаунс), переключатель сортировки (новые/старые — toggle, не dropdown),
 * фильтр по категориям через тот же иерархический мультивыбор, что и в
 * редакторе публикации (поповер). Меняет query-параметры; список — на сервере.
 */
export function PostsToolbar({
  q, categoryIds, sort, categories,
}: {
  q: string
  categoryIds: string[]
  sort: 'new' | 'old'
  categories: CatItem[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [term, setTerm] = useState(q)
  const [catOpen, setCatOpen] = useState(false)
  const [sel, setSel] = useState<string[]>(categoryIds)
  const boxRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  const first = useRef(true)

  function push(patch: Record<string, string | undefined>) {
    const sp = new URLSearchParams(Array.from(params.entries()))
    for (const [k, v] of Object.entries(patch)) { if (v) sp.set(k, v); else sp.delete(k) }
    sp.delete('page')
    const qs = sp.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  // Дебаунс поиска.
  useEffect(() => {
    if (first.current) { first.current = false; return }
    const id = setTimeout(() => push({ q: term.trim() || undefined }), 350)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term])

  // Синхронизация выбранного при навигации.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setSel(categoryIds) }, [categoryIds.join(',')])

  // Позиция поповера (fixed, привязка к правому краю кнопки). Портал в body —
  // чтобы дропдаун не резался overflow/стекингом списка публикаций.
  useLayoutEffect(() => {
    if (!catOpen || !btnRef.current) return
    const r = btnRef.current.getBoundingClientRect()
    const width = 320
    const left = Math.max(8, Math.min(r.right - width, window.innerWidth - width - 8))
    setPos({ left, top: r.bottom + 6 })
  }, [catOpen])

  // Закрытие при скролле вне поповера / ресайзе.
  useEffect(() => {
    if (!catOpen) return
    const onScroll = (e: Event) => {
      const t = e.target as Node | null
      if (t instanceof Element && t.closest('.posts-catpop')) return
      setCatOpen(false)
    }
    const onResize = () => setCatOpen(false)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onResize)
    return () => { window.removeEventListener('scroll', onScroll, true); window.removeEventListener('resize', onResize) }
  }, [catOpen])

  function applyCats() {
    setCatOpen(false)
    const next = sel.join(',')
    if (categoryIds.join(',') !== next) push({ category: next || undefined })
  }

  // Закрытие поповера по клику вне — с применением выбора.
  useEffect(() => {
    if (!catOpen) return
    function onDoc(e: MouseEvent) {
      const t = e.target as Node
      if (boxRef.current?.contains(t) || popRef.current?.contains(t)) return
      applyCats()
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catOpen, sel])

  function toggleSort() { push({ sort: sort === 'new' ? 'old' : undefined }) }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 16, maxWidth: 900 }}>
      <div style={{ position: 'relative', flex: '1 1 220px', minWidth: 180 }}>
        <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--st-text-faint)', pointerEvents: 'none' }} />
        <input
          className="studio-input"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Поиск по названию…"
          style={{ paddingLeft: 34, paddingRight: term ? 30 : 12, width: '100%' }}
        />
        {term && (
          <button type="button" aria-label="Очистить" onClick={() => setTerm('')}
            style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--st-text-faint)', display: 'grid', placeItems: 'center' }}>
            <X size={15} />
          </button>
        )}
      </div>

      <button type="button" onClick={toggleSort} className="studio-btn studio-btn--ghost" style={{ whiteSpace: 'nowrap', flex: '0 0 auto' }} title="Порядок по дате добавления">
        {sort === 'new' ? <ArrowDownWideNarrow size={16} /> : <ArrowUpNarrowWide size={16} />}
        {sort === 'new' ? 'Сначала новые' : 'Сначала старые'}
      </button>

      <div ref={boxRef} style={{ position: 'relative', flex: '0 0 auto' }}>
        <button type="button" ref={btnRef} onClick={() => (catOpen ? applyCats() : setCatOpen(true))} className="studio-btn studio-btn--ghost" style={{ whiteSpace: 'nowrap' }}>
          <ListFilter size={16} />
          {sel.length ? `Категории: ${sel.length}` : 'Все категории'}
          <ChevronDown size={14} style={{ opacity: 0.6 }} />
        </button>
        {catOpen && pos && typeof document !== 'undefined' && createPortal(
          <div ref={popRef} className="posts-catpop" style={{ position: 'fixed', left: pos.left, top: pos.top, zIndex: 2000, width: 320, maxWidth: '86vw', background: 'var(--st-surface)', border: '1px solid var(--st-border)', borderRadius: 12, boxShadow: '0 12px 40px rgba(0,0,0,.25)', padding: 10 }}>
            <CategoryMultiPicker categories={categories} value={sel} onChange={setSel} />
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 10 }}>
              <button type="button" className="studio-btn studio-btn--ghost" onClick={() => setSel([])} disabled={!sel.length}>Сбросить</button>
              <button type="button" className="studio-btn studio-btn--primary" onClick={applyCats}>Применить</button>
            </div>
          </div>,
          document.body,
        )}
      </div>
    </div>
  )
}
