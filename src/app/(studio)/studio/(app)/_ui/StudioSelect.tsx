'use client'

import React, { useEffect, useId, useRef, useState } from 'react'
import { ChevronDown, Check } from 'lucide-react'

/**
 * StudioSelect — кастомный дропдаун в стиле студии (тёмное стекло).
 * Заменяет нативный <select>, чтобы раскрытый список тоже был в дизайн-системе.
 *
 * Полностью управляемый: value + onChange, как у нативного select.
 * Доступность: роль listbox, стрелки/Enter/Esc, закрытие по клику вне.
 *
 * options: массив { value, label, depth? }.
 *   - value — строка (как в нативном select; числа приводите к String заранее).
 *   - label — что показывать.
 *   - depth — необязательный уровень вложенности (для деревьев папок): добавляет
 *     отступ слева, заменяя прежние &nbsp;-хаки.
 */

export type StudioSelectOption = {
  value: string
  label: string
  depth?: number
}

export function StudioSelect({
  value,
  onChange,
  options,
  placeholder,
  disabled = false,
  className,
  ariaLabel,
}: {
  value: string
  onChange: (value: string) => void
  options: StudioSelectOption[]
  placeholder?: string
  disabled?: boolean
  className?: string
  ariaLabel?: string
}) {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState<number>(-1)
  const rootRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const listboxId = useId()

  const selected = options.find((o) => o.value === value) || null
  const displayLabel = selected ? selected.label : (placeholder ?? '—')

  // Закрытие по клику вне и по Esc
  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  // При открытии — активный пункт на выбранном
  useEffect(() => {
    if (open) {
      const idx = options.findIndex((o) => o.value === value)
      setActiveIndex(idx >= 0 ? idx : 0)
    }
  }, [open, value, options])

  function commit(idx: number) {
    const opt = options[idx]
    if (!opt) return
    onChange(opt.value)
    setOpen(false)
  }

  function onTriggerKeyDown(e: React.KeyboardEvent) {
    if (disabled) return
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        setOpen(true)
      }
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i: number) => Math.min(options.length - 1, i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i: number) => Math.max(0, i - 1))
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      commit(activeIndex)
    }
  }

  return (
    <div
      ref={rootRef}
      className={`studio-select${open ? ' is-open' : ''}${disabled ? ' is-disabled' : ''}${className ? ' ' + className : ''}`}
    >
      <button
        type="button"
        className="studio-select__trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => !disabled && setOpen((v: boolean) => !v)}
        onKeyDown={onTriggerKeyDown}
      >
        <span
          className={`studio-select__value${selected ? '' : ' is-placeholder'}`}
        >
          {displayLabel}
        </span>
        <ChevronDown size={16} className="studio-select__caret" aria-hidden />
      </button>

      {open && (
        <div
          ref={listRef}
          className="studio-select__list"
          role="listbox"
          id={listboxId}
          tabIndex={-1}
        >
          {options.map((opt, idx) => {
            const isSelected = opt.value === value
            const isActive = idx === activeIndex
            return (
              <div
                key={opt.value + ':' + idx}
                role="option"
                aria-selected={isSelected}
                className={`studio-select__option${isSelected ? ' is-selected' : ''}${isActive ? ' is-active' : ''}`}
                style={opt.depth ? { paddingLeft: `calc(var(--st-space-3) + ${opt.depth * 14}px)` } : undefined}
                onMouseEnter={() => setActiveIndex(idx)}
                onClick={() => commit(idx)}
              >
                <span className="studio-select__check" aria-hidden>
                  {isSelected ? <Check size={15} /> : null}
                </span>
                <span className="studio-select__option-label">{opt.label}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
