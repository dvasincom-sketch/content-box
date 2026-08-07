'use client'

import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Users, X, Loader2, Crown } from 'lucide-react'

type U = {
  id: number | string
  email: string
  displayName: string
  tierName: string | null
  paid: boolean
  isBlocked: boolean
  subscriptionUntil: string | null
  createdAt: string | null
}

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

/**
 * KPI-плашка «Пользователей» на дашборде: кликабельна, открывает правый drawer
 * со списком всех зарегистрированных (прозрачность данных). Данные грузятся при
 * первом открытии из /studio/api/subscribers-list (только владелец).
 */
export function UsersKpiCard({ registered, registered7d }: { registered: number; registered7d: number }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [users, setUsers] = useState<U[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  async function openDrawer() {
    setOpen(true)
    if (users || loading) return
    setLoading(true); setError(null)
    try {
      const res = await fetch('/studio/api/subscribers-list', { credentials: 'include' })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) setError(j.error || 'Не удалось загрузить')
      else setUsers(j.users || [])
    } catch {
      setError('Ошибка соединения')
    } finally {
      setLoading(false)
    }
  }

  const drawer = (
    <div className="uk-overlay" role="dialog" aria-modal="true" onClick={() => setOpen(false)}>
      <div className="uk-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="uk-drawer__head">
          <div>
            <h3>Пользователи</h3>
            <div className="uk-drawer__sub">Всего: {users ? users.length : registered}</div>
          </div>
          <button className="catmgr__icon-btn" onClick={() => setOpen(false)} aria-label="Закрыть"><X size={18} /></button>
        </div>
        <div className="uk-drawer__body">
          {loading ? (
            <div className="uk-empty"><Loader2 size={18} className="spin" /> Загрузка…</div>
          ) : error ? (
            <div className="settings__err">{error}</div>
          ) : !users || users.length === 0 ? (
            <div className="uk-empty">Пользователей пока нет.</div>
          ) : (
            <div className="uk-list">
              {users.map((u) => (
                <div key={u.id} className="uk-row">
                  <span className="uk-ava">{(u.displayName || u.email || '?').slice(0, 1).toUpperCase()}</span>
                  <div className="uk-row__main">
                    <div className="uk-row__name">{u.displayName || u.email}{u.isBlocked && <span className="uk-tag uk-tag--blocked">заблокирован</span>}</div>
                    {u.displayName && <div className="uk-row__email">{u.email}</div>}
                    <div className="uk-row__meta">рег. {fmt(u.createdAt)}</div>
                  </div>
                  <div className="uk-row__right">
                    {u.paid ? (
                      <span className="uk-tag uk-tag--paid"><Crown size={12} /> {u.tierName || 'Платный'}</span>
                    ) : (
                      <span className="uk-tag">Бесплатный</span>
                    )}
                    {u.paid && u.subscriptionUntil && <div className="uk-row__until">до {fmt(u.subscriptionUntil)}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )

  return (
    <>
      <button type="button" className="dash__kpi dash__kpi--click" onClick={openDrawer} title="Показать всех пользователей">
        <div className="dash__kpi-icon"><Users size={16} /></div>
        <div className="dash__kpi-body">
          <div className="dash__kpi-value">{registered}</div>
          <div className="dash__kpi-label">Пользователей</div>
        </div>
        {registered7d > 0 && <div className="dash__kpi-delta">+{registered7d} за 7 дн.</div>}
      </button>
      {mounted && open && createPortal(drawer, document.body)}
    </>
  )
}
