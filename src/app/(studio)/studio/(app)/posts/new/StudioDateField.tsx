'use client'

import React, { useEffect, useRef, useState } from 'react'
import { Calendar as CalIcon, ChevronLeft, ChevronRight, X } from 'lucide-react'

/**
 * Поле даты в стиле студии (замена нативного <input type="date">).
 * - Ввод с клавиатуры подряд: цифры ДДММГГГГ, точки подставляются сами,
 *   курсор не надо кликать по сегментам.
 * - Всплывающий календарь на токенах студии (--st-*), сам под светлую/тёмную тему.
 * value/onChange — строка ISO 'YYYY-MM-DD' или '' (пусто).
 */

const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']
const WEEK = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

function pad(n: number): string { return String(n).padStart(2, '0') }

/** 'YYYY-MM-DD' → 'DD.MM.YYYY' (или ''). */
function isoToDisplay(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '')
  return m ? `${m[3]}.${m[2]}.${m[1]}` : ''
}

/** до 8 цифр → маска 'DD.MM.YYYY' по мере ввода. */
function digitsToMask(digits: string): string {
  const d = digits.slice(0, 8)
  let out = d.slice(0, 2)
  if (d.length >= 3) out += '.' + d.slice(2, 4)
  if (d.length >= 5) out += '.' + d.slice(4, 8)
  return out
}

/** Валидная дата из 'DD.MM.YYYY' → ISO, иначе ''. */
function maskToIso(mask: string): string {
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(mask)
  if (!m) return ''
  const day = Number(m[1]), mon = Number(m[2]), year = Number(m[3])
  if (mon < 1 || mon > 12 || day < 1 || year < 1900 || year > 2999) return ''
  const dt = new Date(year, mon - 1, day)
  if (dt.getFullYear() !== year || dt.getMonth() !== mon - 1 || dt.getDate() !== day) return ''
  return `${year}-${pad(mon)}-${pad(day)}`
}

export function StudioDateField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [text, setText] = useState<string>(isoToDisplay(value))
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<{ y: number; m: number }>(() => {
    const m = /^(\d{4})-(\d{2})-/.exec(value || '')
    const now = new Date()
    return m ? { y: Number(m[1]), m: Number(m[2]) - 1 } : { y: now.getFullYear(), m: now.getMonth() }
  })
  const wrapRef = useRef<HTMLDivElement>(null)

  // Синхронизируем текст при внешней смене value.
  useEffect(() => { setText(isoToDisplay(value)) }, [value])

  // Закрытие по клику вне.
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const selectedIso = maskToIso(text) || (isoToDisplay(value) === text ? value : '')

  function commit(mask: string) {
    const iso = maskToIso(mask)
    onChange(iso) // '' пока дата неполная/невалидная — родитель хранит пусто
    if (iso) {
      setView({ y: Number(iso.slice(0, 4)), m: Number(iso.slice(5, 7)) - 1 })
    }
  }

  function onInput(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, '')
    const mask = digitsToMask(digits)
    setText(mask)
    commit(mask)
  }

  function pick(day: number) {
    const iso = `${view.y}-${pad(view.m + 1)}-${pad(day)}`
    setText(isoToDisplay(iso))
    onChange(iso)
    setOpen(false)
  }

  function clear() {
    setText(''); onChange(''); setOpen(false)
  }

  function shiftMonth(delta: number) {
    setView((v) => {
      const d = new Date(v.y, v.m + delta, 1)
      return { y: d.getFullYear(), m: d.getMonth() }
    })
  }

  // Сетка дней месяца (понедельник — первый).
  const first = new Date(view.y, view.m, 1)
  const startOffset = (first.getDay() + 6) % 7 // 0=Пн
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate()
  const cells: (number | null)[] = []
  for (let i = 0; i < startOffset; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const today = new Date()
  const isToday = (d: number) => today.getFullYear() === view.y && today.getMonth() === view.m && today.getDate() === d
  const selDay = selectedIso && Number(selectedIso.slice(0, 4)) === view.y && Number(selectedIso.slice(5, 7)) - 1 === view.m
    ? Number(selectedIso.slice(8, 10)) : null

  return (
    <div className="sdate" ref={wrapRef}>
      <div className="sdate__control">
        <input
          className="studio-input sdate__input"
          value={text}
          onChange={onInput}
          onFocus={() => setOpen(true)}
          placeholder="ДД.ММ.ГГГГ"
          inputMode="numeric"
          maxLength={10}
          aria-label="Дата события"
        />
        {text ? (
          <button type="button" className="sdate__icon" onClick={clear} title="Очистить" aria-label="Очистить"><X size={15} /></button>
        ) : (
          <button type="button" className="sdate__icon" onClick={() => setOpen((o) => !o)} title="Календарь" aria-label="Открыть календарь"><CalIcon size={15} /></button>
        )}
      </div>

      {open && (
        <div className="sdate__pop" role="dialog">
          <div className="sdate__nav">
            <button type="button" className="sdate__navbtn" onClick={() => shiftMonth(-1)} aria-label="Предыдущий месяц"><ChevronLeft size={16} /></button>
            <span className="sdate__title">{MONTHS[view.m]} {view.y}</span>
            <button type="button" className="sdate__navbtn" onClick={() => shiftMonth(1)} aria-label="Следующий месяц"><ChevronRight size={16} /></button>
          </div>
          <div className="sdate__week">
            {WEEK.map((w) => <span key={w} className="sdate__wd">{w}</span>)}
          </div>
          <div className="sdate__grid">
            {cells.map((d, i) => d == null ? (
              <span key={`e${i}`} className="sdate__cell sdate__cell--empty" />
            ) : (
              <button
                type="button"
                key={d}
                className={`sdate__cell${selDay === d ? ' is-selected' : ''}${isToday(d) ? ' is-today' : ''}`}
                onClick={() => pick(d)}
              >
                {d}
              </button>
            ))}
          </div>
          <div className="sdate__foot">
            <button type="button" className="sdate__foot-btn" onClick={() => { const t = new Date(); pickAt(t) }}>Сегодня</button>
            <button type="button" className="sdate__foot-btn" onClick={clear}>Очистить</button>
          </div>
        </div>
      )}
    </div>
  )

  function pickAt(t: Date) {
    const iso = `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`
    setView({ y: t.getFullYear(), m: t.getMonth() })
    setText(isoToDisplay(iso))
    onChange(iso)
    setOpen(false)
  }
}
