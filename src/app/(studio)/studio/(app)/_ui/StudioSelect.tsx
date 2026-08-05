'use client'

import React, { useEffect, useId, useMemo, useRef, useState } from 'react'
import { ChevronDown, Check, Search } from 'lucide-react'

/**
 * StudioSelect — кастомный дропдаун в стиле студии. Заменяет нативный <select>.
 * Поддерживает depth (дерево, отступ) и поиск по списку (авто при >8 пунктах
 * или явно через searchable) — для длинных списков (видео, категории).
 */

export type StudioSelectOption = { value: string; label: string; depth?: number }

export function StudioSelect({
  value, onChange, options, placeholder, disabled = false, className, ariaLabel, searchable,
}: {
  value: string
  onChange: (value: string) => void
  options: StudioSelectOption[]
  placeholder?: string
  disabled?: boolean
  className?: string
  ariaLabel?: string
  searchable?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState<number>(-1)
  const rootRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const listboxId = useId()

  const showSearch = (searchable ?? options.length > 8)
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options
  }, [query, options])

  const selected = options.find((o) => o.value === value) || null
  const displayLabel = selected ? selected.label : (placeholder ?? '—')

  useEffect(() => {
    if (!open) { setQuery(''); return }
    function onDocClick(e: MouseEvent) { if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false) }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    if (showSearch) setTimeout(() => searchRef.current?.focus(), 0)
    return () => { document.removeEventListener('mousedown', onDocClick); document.removeEventListener('keydown', onKey) }
  }, [open, showSearch])

  useEffect(() => {
    if (open) {
      const idx = shown.findIndex((o) => o.value === value)
      setActiveIndex(idx >= 0 ? idx : 0)
    }
  }, [open, value, shown])

  function commit(opt?: StudioSelectOption) {
    if (!opt) return
    onChange(opt.value)
    setOpen(false)
    setQuery('')
  }

  function onKeyNav(e: React.KeyboardEvent) {
    if (disabled) return
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(true) }
      return
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex((i) => Math.min(shown.length - 1, i + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex((i) => Math.max(0, i - 1)) }
    else if (e.key === 'Enter') { e.preventDefault(); commit(shown[activeIndex]) }
  }

  return (
    <div ref={rootRef} className={`studio-select${open ? ' is-open' : ''}${disabled ? ' is-disabled' : ''}${className ? ' ' + className : ''}`}>
      <button
        type="button" className="studio-select__trigger" aria-haspopup="listbox" aria-expanded={open}
        aria-label={ariaLabel} disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)} onKeyDown={onKeyNav}
      >
        <span className={`studio-select__value${selected ? '' : ' is-placeholder'}`}>{displayLabel}</span>
        <ChevronDown size={16} className="studio-select__caret" aria-hidden />
      </button>

      {open && (
        <div className="studio-select__list" role="listbox" id={listboxId} tabIndex={-1}>
          {showSearch && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderBottom: '1px solid var(--st-border)', position: 'sticky', top: 0, background: 'var(--st-surface)' }}>
              <Search size={15} style={{ color: 'var(--st-text-muted)', flex: 'none' }} />
              <input
                ref={searchRef} value={query} onChange={(e) => { setQuery(e.target.value); setActiveIndex(0) }}
                onKeyDown={onKeyNav} placeholder="Поиск…"
                style={{ flex: 1, minWidth: 0, background: 'transparent', border: 0, outline: 'none', color: 'var(--st-text)', fontSize: 'var(--st-text-md)' }}
              />
            </div>
          )}
          {shown.length === 0 ? (
            <div style={{ padding: '10px 12px', color: 'var(--st-text-muted)', fontSize: 'var(--st-text-sm)' }}>Ничего не найдено</div>
          ) : shown.map((opt, idx) => {
            const isSelected = opt.value === value
            const isActive = idx === activeIndex
            return (
              <div
                key={opt.value + ':' + idx} role="option" aria-selected={isSelected}
                className={`studio-select__option${isSelected ? ' is-selected' : ''}${isActive ? ' is-active' : ''}`}
                style={opt.depth ? { paddingLeft: `calc(var(--st-space-3) + ${opt.depth * 14}px)` } : undefined}
                onMouseEnter={() => setActiveIndex(idx)} onClick={() => commit(opt)}
              >
                <span className="studio-select__check" aria-hidden>{isSelected ? <Check size={15} /> : null}</span>
                <span className="studio-select__option-label">{opt.label}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
