'use client'

import React, { useEffect, useRef, useState } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Search, X } from 'lucide-react'

/**
 * Панель фильтров ленты публикаций студии: быстрый поиск по названию (дебаунс),
 * фильтр по категории (иерархия — отступами), сортировка (новые/старые). Меняет
 * query-параметры адреса; список пересобирается на сервере. Смена любого фильтра
 * сбрасывает страницу на первую.
 */
type Cat = { id: string; label: string; depth: number }

export function PostsToolbar({
  q, categoryId, sort, categories,
}: {
  q: string
  categoryId: string
  sort: 'new' | 'old'
  categories: Cat[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [term, setTerm] = useState(q)
  const first = useRef(true)

  function push(patch: Record<string, string | undefined>) {
    const sp = new URLSearchParams(Array.from(params.entries()))
    for (const [k, v] of Object.entries(patch)) { if (v) sp.set(k, v); else sp.delete(k) }
    sp.delete('page') // при смене фильтра — на первую страницу
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

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 16 }}>
      <div style={{ position: 'relative', flex: '1 1 240px', minWidth: 200 }}>
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

      <select className="studio-input" value={categoryId} onChange={(e) => push({ category: e.target.value || undefined })} style={{ flex: '0 1 240px', minWidth: 180 }} aria-label="Категория">
        <option value="">Все категории</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>{'  '.repeat(c.depth) + (c.depth ? '└ ' : '') + c.label}</option>
        ))}
      </select>

      <select className="studio-input" value={sort} onChange={(e) => push({ sort: e.target.value === 'old' ? 'old' : undefined })} style={{ flex: '0 0 auto', minWidth: 150 }} aria-label="Сортировка">
        <option value="new">Сначала новые</option>
        <option value="old">Сначала старые</option>
      </select>
    </div>
  )
}
