'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { Rocket, Check, Circle, ArrowRight, X } from 'lucide-react'

/**
 * Карточка «Запуск проекта» на дашборде. Ширина ограничена под контент ниже
 * (max-width 720 — как у .dash__kpis/.dash__chart-card), закрывается крестиком
 * в правом верхнем углу (запоминается в localStorage, больше не показывается).
 */

type Task = { done: boolean; label: string; href: string }
const KEY = 'cbx-launch-dismissed'

export function LaunchChecklist({ tasks, doneN }: { tasks: Task[]; doneN: number }) {
  const [mounted, setMounted] = useState(false)
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    setMounted(true)
    try { if (localStorage.getItem(KEY) === '1') setHidden(true) } catch { /* no-op */ }
  }, [])

  if (!mounted || hidden) return null

  function dismiss() {
    setHidden(true)
    try { localStorage.setItem(KEY, '1') } catch { /* no-op */ }
  }

  return (
    <div style={{ position: 'relative', maxWidth: 720, padding: 20, marginBottom: 18, border: '1px solid var(--st-border)', borderRadius: 'var(--st-radius, 12px)', background: 'var(--st-surface)' }}>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Скрыть"
        title="Скрыть"
        style={{ position: 'absolute', top: 12, right: 12, width: 30, height: 30, display: 'grid', placeItems: 'center', border: 'none', background: 'transparent', color: 'var(--st-text-faint)', cursor: 'pointer', borderRadius: 8 }}
      >
        <X size={17} />
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 12, paddingRight: 34 }}>
        <span style={{ width: 34, height: 34, borderRadius: 10, display: 'grid', placeItems: 'center', background: 'var(--st-accent)', color: 'var(--st-accent-text)', flex: 'none' }}><Rocket size={18} /></span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--st-text)' }}>Запуск проекта</div>
          <div style={{ fontSize: 13, color: 'var(--st-text-muted)' }}>Сделано {doneN} из {tasks.length} — пара шагов до живого сайта</div>
        </div>
      </div>

      <div style={{ height: 6, borderRadius: 999, background: 'var(--st-surface-2)', overflow: 'hidden', marginBottom: 14 }}>
        <div style={{ height: '100%', width: `${Math.round((doneN / tasks.length) * 100)}%`, background: 'var(--st-accent)', transition: 'width .3s' }} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {tasks.map((t, i) => (
          <Link key={i} href={t.href} style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: t.done ? 'var(--st-text-muted)' : 'var(--st-text)', fontSize: 14 }}>
            <span style={{ flex: 'none', display: 'inline-flex', color: t.done ? 'var(--st-success, #22c55e)' : 'var(--st-text-faint)' }}>{t.done ? <Check size={18} /> : <Circle size={18} />}</span>
            <span style={{ flex: 1, textDecoration: t.done ? 'line-through' : 'none' }}>{t.label}</span>
            {!t.done && <ArrowRight size={15} style={{ color: 'var(--st-text-faint)' }} />}
          </Link>
        ))}
      </div>
    </div>
  )
}
