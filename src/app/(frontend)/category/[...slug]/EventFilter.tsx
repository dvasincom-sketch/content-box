'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Calendar as CalIcon, ChevronDown, ChevronLeft, ChevronRight, Check } from 'lucide-react'

/**
 * Фирменный фильтр разделов-событий (фан-сайт, токены --brand-*).
 * Заменяет нативные <select> и <input type="date">:
 *  - «Сортировка» — свой выпадающий список (не системный select).
 *  - «Период» — ОДНО окно: календарь-диапазон (два клика) + пресеты
 *    (сегодня / 7 / 30 дней / этот-прошлый месяц / год / весь период) и
 *    выбор целого месяца одним кликом по заголовку («за декабрь»).
 * Применение — клиентская навигация с ?sort&from&to (сервер уже так читает).
 */

type Sort = 'new' | 'old'

const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']
const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря']
const WEEK = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

function pad(n: number): string { return String(n).padStart(2, '0') }
function iso(y: number, m: number, d: number): string { return `${y}-${pad(m + 1)}-${pad(d)}` }
function isoOfDate(dt: Date): string { return iso(dt.getFullYear(), dt.getMonth(), dt.getDate()) }

/** 'YYYY-MM-DD' → 'DD.MM.YYYY' (или ''). */
function disp(v: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || '')
  return m ? `${m[3]}.${m[2]}.${m[1]}` : ''
}

function parse(v: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || '')
  return m ? { y: Number(m[1]), m: Number(m[2]) - 1, d: Number(m[3]) } : null
}

function lastDay(y: number, m: number): number { return new Date(y, m + 1, 0).getDate() }

/** Красивая подпись выбранного периода для кнопки. */
function periodLabel(from: string, to: string): string {
  if (!from && !to) return 'Весь период'
  const f = parse(from), t = parse(to)
  // Целый месяц → «Декабрь 2025».
  if (f && t && f.y === t.y && f.m === t.m && f.d === 1 && t.d === lastDay(t.y, t.m)) {
    return `${MONTHS[f.m]} ${f.y}`
  }
  // Целый год → «2025 год».
  if (f && t && f.y === t.y && f.m === 0 && f.d === 1 && t.m === 11 && t.d === 31) {
    return `${f.y} год`
  }
  if (f && t) {
    if (f.y === t.y) return `${f.d} ${MONTHS_GEN[f.m]} — ${t.d} ${MONTHS_GEN[t.m]} ${t.y}`
    return `${disp(from)} — ${disp(to)}`
  }
  if (f) return `с ${disp(from)}`
  return `по ${disp(to)}`
}

export function EventFilter({ sort: sort0, from: from0, to: to0 }: { sort: Sort; from: string; to: string }) {
  const router = useRouter()
  const pathname = usePathname()

  const [sort, setSort] = useState<Sort>(sort0)
  const [from, setFrom] = useState(from0)
  const [to, setTo] = useState(to0)

  const [sortOpen, setSortOpen] = useState(false)
  const [periodOpen, setPeriodOpen] = useState(false)

  const [view, setView] = useState(() => {
    const f = parse(from0)
    const now = new Date()
    return f ? { y: f.y, m: f.m } : { y: now.getFullYear(), m: now.getMonth() }
  })

  const sortWrap = useRef<HTMLDivElement>(null)
  const periodWrap = useRef<HTMLDivElement>(null)

  // Закрытие поповеров по клику вне.
  useEffect(() => {
    if (!sortOpen && !periodOpen) return
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node
      if (sortOpen && sortWrap.current && !sortWrap.current.contains(t)) setSortOpen(false)
      if (periodOpen && periodWrap.current && !periodWrap.current.contains(t)) setPeriodOpen(false)
    }
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') { setSortOpen(false); setPeriodOpen(false) } }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onEsc)
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onEsc) }
  }, [sortOpen, periodOpen])

  function apply(next?: { sort?: Sort; from?: string; to?: string }) {
    const s = next?.sort ?? sort
    const f = next?.from ?? from
    const t = next?.to ?? to
    const p = new URLSearchParams()
    if (s === 'old') p.set('sort', 'old')
    if (f) p.set('from', f)
    if (t) p.set('to', t)
    const qs = p.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname)
    setSortOpen(false)
    setPeriodOpen(false)
  }

  function chooseSort(s: Sort) {
    setSort(s)
    apply({ sort: s })
  }

  function resetAll() {
    setSort('new'); setFrom(''); setTo('')
    router.push(pathname)
    setSortOpen(false); setPeriodOpen(false)
  }

  // — Пресеты периода (относительно сегодня, клиент) —
  function setRange(f: string, t: string) {
    setFrom(f); setTo(t)
    const p = parse(f)
    if (p) setView({ y: p.y, m: p.m })
  }
  const presets = useMemo(() => {
    const now = new Date()
    const y = now.getFullYear(), m = now.getMonth()
    const startOf = (dt: Date) => isoOfDate(dt)
    const minus = (days: number) => { const d = new Date(now); d.setDate(d.getDate() - days + 1); return isoOfDate(d) }
    const prevM = m === 0 ? 11 : m - 1
    const prevY = m === 0 ? y - 1 : y
    return [
      { key: 'all', label: 'Весь период', range: ['', ''] as [string, string] },
      { key: 'today', label: 'Сегодня', range: [startOf(now), startOf(now)] as [string, string] },
      { key: 'd7', label: 'Последние 7 дней', range: [minus(7), startOf(now)] as [string, string] },
      { key: 'd30', label: 'Последние 30 дней', range: [minus(30), startOf(now)] as [string, string] },
      { key: 'thisM', label: 'Этот месяц', range: [iso(y, m, 1), iso(y, m, lastDay(y, m))] as [string, string] },
      { key: 'prevM', label: 'Прошлый месяц', range: [iso(prevY, prevM, 1), iso(prevY, prevM, lastDay(prevY, prevM))] as [string, string] },
      { key: 'thisY', label: 'Этот год', range: [iso(y, 0, 1), iso(y, 11, 31)] as [string, string] },
    ]
  }, [])

  function shiftMonth(delta: number) {
    setView((v) => { const d = new Date(v.y, v.m + delta, 1); return { y: d.getFullYear(), m: d.getMonth() } })
  }
  function pickWholeMonth() {
    setRange(iso(view.y, view.m, 1), iso(view.y, view.m, lastDay(view.y, view.m)))
  }
  function pickDay(day: number) {
    const v = iso(view.y, view.m, day)
    if (!from || (from && to)) { setFrom(v); setTo('') }
    else if (v < from) { setFrom(v); setTo('') }
    else setTo(v)
  }

  // Сетка дней (Пн — первый).
  const first = new Date(view.y, view.m, 1)
  const startOffset = (first.getDay() + 6) % 7
  const dim = lastDay(view.y, view.m)
  const cells: (number | null)[] = []
  for (let i = 0; i < startOffset; i++) cells.push(null)
  for (let d = 1; d <= dim; d++) cells.push(d)

  const today = new Date()
  const isToday = (d: number) => today.getFullYear() === view.y && today.getMonth() === view.m && today.getDate() === d
  function dayState(d: number): string {
    const v = iso(view.y, view.m, d)
    let cls = ''
    if (from && v === from) cls += ' is-from'
    if (to && v === to) cls += ' is-to'
    if (from && to && v > from && v < to) cls += ' is-in'
    if (from && !to && v === from) cls += ' is-from is-to'
    if (isToday(d)) cls += ' is-today'
    return cls
  }

  const hasFilter = Boolean(from || to || sort === 'old')

  return (
    <div className="evf">
      {/* Сортировка — свой выпадающий список */}
      <div className="evf__field" ref={sortWrap}>
        <span className="evf__lbl">Сортировка</span>
        <div className="evf__dd">
          <button
            type="button"
            className={`evf__ctl evf__ddbtn${sortOpen ? ' is-open' : ''}`}
            onClick={() => { setSortOpen((o) => !o); setPeriodOpen(false) }}
            aria-haspopup="listbox"
            aria-expanded={sortOpen}
          >
            <span>{sort === 'old' ? 'Сначала старые' : 'Сначала новые'}</span>
            <ChevronDown size={16} className="evf__caret" aria-hidden />
          </button>
          {sortOpen && (
            <div className="evf__menu" role="listbox">
              {([['new', 'Сначала новые'], ['old', 'Сначала старые']] as [Sort, string][]).map(([v, lbl]) => (
                <button
                  key={v}
                  type="button"
                  role="option"
                  aria-selected={sort === v}
                  className={`evf__opt${sort === v ? ' is-active' : ''}`}
                  onClick={() => chooseSort(v)}
                >
                  <span>{lbl}</span>
                  {sort === v && <Check size={15} aria-hidden />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Период — одно окно: календарь-диапазон + пресеты */}
      <div className="evf__field" ref={periodWrap}>
        <span className="evf__lbl">Период</span>
        <div className="evf__dd">
          <button
            type="button"
            className={`evf__ctl evf__period${periodOpen ? ' is-open' : ''}${(from || to) ? ' is-set' : ''}`}
            onClick={() => { setPeriodOpen((o) => !o); setSortOpen(false) }}
            aria-haspopup="dialog"
            aria-expanded={periodOpen}
          >
            <CalIcon size={15} className="evf__period-ic" aria-hidden />
            <span className="evf__period-txt">{periodLabel(from, to)}</span>
            <ChevronDown size={16} className="evf__caret" aria-hidden />
          </button>

          {periodOpen && (
            <div className="evf__pop" role="dialog" aria-label="Выбор периода">
              <div className="evf__presets">
                {presets.map((p) => {
                  const active = (from || '') === p.range[0] && (to || '') === p.range[1]
                  return (
                    <button
                      key={p.key}
                      type="button"
                      className={`evf__preset${active ? ' is-active' : ''}`}
                      onClick={() => setRange(p.range[0], p.range[1])}
                    >
                      {p.label}
                    </button>
                  )
                })}
              </div>

              <div className="evf__cal">
                <div className="evf__cal-nav">
                  <button type="button" className="evf__navbtn" onClick={() => shiftMonth(-1)} aria-label="Предыдущий месяц"><ChevronLeft size={16} /></button>
                  <button type="button" className="evf__cal-title" onClick={pickWholeMonth} title="Выбрать весь месяц">
                    {MONTHS[view.m]} {view.y}
                  </button>
                  <button type="button" className="evf__navbtn" onClick={() => shiftMonth(1)} aria-label="Следующий месяц"><ChevronRight size={16} /></button>
                </div>
                <div className="evf__cal-week">
                  {WEEK.map((w) => <span key={w} className="evf__wd">{w}</span>)}
                </div>
                <div className="evf__cal-grid">
                  {cells.map((d, i) => d == null ? (
                    <span key={`e${i}`} className="evf__cell evf__cell--empty" />
                  ) : (
                    <button type="button" key={d} className={`evf__cell${dayState(d)}`} onClick={() => pickDay(d)}>{d}</button>
                  ))}
                </div>
                <div className="evf__cal-hint">Клик по названию месяца выберет его целиком</div>
              </div>

              <div className="evf__pop-foot">
                <button type="button" className="evf__foot-clear" onClick={() => setRange('', '')}>Очистить</button>
                <button type="button" className="c-btn c-btn--primary c-btn--sm" onClick={() => apply()}>Применить</button>
              </div>
            </div>
          )}
        </div>
      </div>

      <button type="button" className="c-btn c-btn--primary evf__go" onClick={() => apply()}>Показать</button>
      {hasFilter && (
        <button type="button" className="evf__reset" onClick={resetAll} title="Сбросить фильтр">Сбросить</button>
      )}
    </div>
  )
}
