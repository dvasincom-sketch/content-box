'use client'

import React, { useMemo, useState } from 'react'
import type { UmamiPoint } from '@/lib/umamiStats'

/**
 * График посещаемости: область просмотров + линия посетителей. Данные уже
 * срезаны под выбранный диапазон на сервере (диапазон меняется ссылками на
 * странице, т.к. KPI зависят от периода). Переиспользуем стили .dashchart__*
 * от дашборда. SVG без библиотек, non-scaling-stroke.
 */

const W = 800
const H = 200
const PAD_TOP = 14
const PAD_BOTTOM = 14

function fmtDay(iso: string): string {
  const [, m, d] = iso.split('-')
  return d && m ? `${d}.${m}` : iso
}

function buildPath(vals: number[], max: number, close: boolean): string {
  const n = vals.length
  if (n === 0) return ''
  const innerH = H - PAD_TOP - PAD_BOTTOM
  const x = (i: number) => (n === 1 ? W / 2 : (i / (n - 1)) * W)
  const y = (v: number) => PAD_TOP + innerH - (max > 0 ? (v / max) * innerH : 0)
  let dPath = `M ${x(0).toFixed(1)} ${y(vals[0]).toFixed(1)}`
  for (let i = 1; i < n; i++) dPath += ` L ${x(i).toFixed(1)} ${y(vals[i]).toFixed(1)}`
  if (close) dPath += ` L ${x(n - 1).toFixed(1)} ${H} L ${x(0).toFixed(1)} ${H} Z`
  return dPath
}

export function UmamiChart({ series }: { series: UmamiPoint[] }) {
  const [hover, setHover] = useState<number | null>(null)

  const pv = useMemo(() => series.map((d) => d.pageviews), [series])
  const vis = useMemo(() => series.map((d) => d.visitors), [series])
  const max = Math.max(1, ...pv, ...vis)
  const totalPv = pv.reduce((s, v) => s + v, 0)
  const totalVis = vis.reduce((s, v) => s + v, 0)

  const pvArea = buildPath(pv, max, true)
  const pvLine = buildPath(pv, max, false)
  const visLine = buildPath(vis, max, false)

  const n = series.length
  const hoverRatio = hover != null && n > 1 ? hover / (n - 1) : 0
  const hoverDay = hover != null ? series[hover] : null

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    if (rect.width <= 0 || n === 0) return
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
    setHover(Math.round(ratio * (n - 1)))
  }

  if (n === 0) {
    return <div className="an__empty an__empty--sm">Нет данных за период</div>
  }

  return (
    <div className="dashchart">
      <div className="dashchart__head">
        <div className="dashchart__legend">
          <span className="dashchart__lg"><i className="dashchart__sw dashchart__sw--regs" /> Просмотры <b>{totalPv}</b></span>
          <span className="dashchart__lg"><i className="dashchart__sw dashchart__sw--paid" /> Посетители <b>{totalVis}</b></span>
        </div>
      </div>

      <div className="dashchart__plot" onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        <svg className="dashchart__svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden>
          <defs>
            <linearGradient id="umami-pv" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--st-accent)" stopOpacity="0.28" />
              <stop offset="100%" stopColor="var(--st-accent)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0.25, 0.5, 0.75].map((g) => (
            <line key={g} x1="0" x2={W} y1={PAD_TOP + (H - PAD_TOP - PAD_BOTTOM) * g} y2={PAD_TOP + (H - PAD_TOP - PAD_BOTTOM) * g} className="dashchart__grid" vectorEffect="non-scaling-stroke" />
          ))}
          <path d={pvArea} fill="url(#umami-pv)" />
          <path d={pvLine} className="dashchart__line dashchart__line--regs" fill="none" vectorEffect="non-scaling-stroke" />
          <path d={visLine} className="dashchart__line dashchart__line--paid" fill="none" vectorEffect="non-scaling-stroke" />
        </svg>

        {hoverDay && (
          <>
            <div className="dashchart__cursor" style={{ left: `${hoverRatio * 100}%` }} />
            <div
              className="dashchart__tip"
              style={{ left: `${hoverRatio * 100}%`, transform: `translateX(${hoverRatio > 0.7 ? '-100%' : hoverRatio < 0.3 ? '0' : '-50%'})` }}
            >
              <div className="dashchart__tip-day">{fmtDay(hoverDay.day)}</div>
              <div className="dashchart__tip-row"><i className="dashchart__sw dashchart__sw--regs" />Просмотры: <b>{hoverDay.pageviews}</b></div>
              <div className="dashchart__tip-row"><i className="dashchart__sw dashchart__sw--paid" />Посетители: <b>{hoverDay.visitors}</b></div>
            </div>
          </>
        )}
      </div>

      <div className="dashchart__axis">
        <span>{series[0] ? fmtDay(series[0].day) : ''}</span>
        <span>{series[n - 1] ? fmtDay(series[n - 1].day) : ''}</span>
      </div>
    </div>
  )
}
