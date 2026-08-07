'use client'

import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Users, X, Loader2, Crown, ChevronLeft, ChevronRight,
  LogIn, UserPlus, Eye, MessageSquare, Heart, Bookmark, Star, Ban,
} from 'lucide-react'

type U = {
  id: number | string
  email: string
  displayName: string
  tierName: string | null
  paid: boolean
  isBlocked: boolean
  subscriptionUntil: string | null
  createdAt: string | null
  lastSeenAt: string | null
}

type Ev = {
  id: number | string
  action: string
  targetType: string | null
  targetTitle: string | null
  targetUrl: string | null
  meta: Record<string, any> | null
  at: string
}

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

// Последний вход — дата и время (минуты), чтобы «был(а) сегодня» читалось точнее.
const fmtSeen = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString('ru-RU', {
        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
      })
    : null

// Время события с точностью до секунды.
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
const dayLabel = (iso: string) => {
  const d = new Date(iso)
  const today = new Date()
  const y = new Date(); y.setDate(today.getDate() - 1)
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString()
  if (same(d, today)) return 'Сегодня'
  if (same(d, y)) return 'Вчера'
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
}

// Метаданные действий: иконка + человекочитаемая формулировка.
const ACTIONS: Record<string, { icon: React.ComponentType<any>; verb: string; withTarget?: boolean }> = {
  login: { icon: LogIn, verb: 'Вошёл(ла) на сайт' },
  register: { icon: UserPlus, verb: 'Зарегистрировался(ась)' },
  view: { icon: Eye, verb: 'Открыл(а)', withTarget: true },
  comment: { icon: MessageSquare, verb: 'Оставил(а) комментарий', withTarget: true },
  reaction: { icon: Heart, verb: 'Поставил(а) реакцию', withTarget: true },
  bookmark: { icon: Bookmark, verb: 'Добавил(а) в закладки', withTarget: true },
  follow: { icon: UserPlus, verb: 'Подписался(ась) на', withTarget: true },
  subscribe: { icon: Crown, verb: 'Оформил(а) подписку', withTarget: true },
  unsubscribe: { icon: Ban, verb: 'Отменил(а) подписку' },
  subscription_change: { icon: Star, verb: 'Сменил(а) тариф', withTarget: true },
}

/**
 * KPI-плашка «Пользователей» на дашборде: кликабельна, открывает правый drawer
 * со списком всех зарегистрированных (прозрачность данных). Клик по пользователю
 * открывает таймлайн его действий (значимые события, время до секунды).
 * Данные — из /studio/api/subscribers-list и /studio/api/subscriber-activity
 * (только владелец студии).
 */
export function UsersKpiCard({ registered, registered7d }: { registered: number; registered7d: number }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [users, setUsers] = useState<U[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  // Выбранный пользователь и его лог действий.
  const [selected, setSelected] = useState<U | null>(null)
  const [events, setEvents] = useState<Ev[] | null>(null)
  const [evLoading, setEvLoading] = useState(false)
  const [evError, setEvError] = useState<string | null>(null)

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

  async function openUser(u: U) {
    setSelected(u)
    setEvents(null); setEvError(null); setEvLoading(true)
    try {
      const res = await fetch(`/studio/api/subscriber-activity?subscriber=${encodeURIComponent(String(u.id))}`, { credentials: 'include' })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) setEvError(j.error || 'Не удалось загрузить')
      else setEvents(j.events || [])
    } catch {
      setEvError('Ошибка соединения')
    } finally {
      setEvLoading(false)
    }
  }

  function closeAll() { setOpen(false); setSelected(null) }

  const list = (
    !users || users.length === 0 ? (
      <div className="uk-empty">Пользователей пока нет.</div>
    ) : (
      <div className="uk-list">
        {users.map((u) => (
          <button key={u.id} type="button" className="uk-row uk-row--btn" onClick={() => openUser(u)}>
            <span className="uk-ava">{(u.displayName || u.email || '?').slice(0, 1).toUpperCase()}</span>
            <div className="uk-row__main">
              <div className="uk-row__name">{u.displayName || u.email}{u.isBlocked && <span className="uk-tag uk-tag--blocked">заблокирован</span>}</div>
              {u.displayName && <div className="uk-row__email">{u.email}</div>}
              <div className="uk-row__meta">рег. {fmt(u.createdAt)} · {u.lastSeenAt ? `был(а) ${fmtSeen(u.lastSeenAt)}` : 'ещё не входил(а)'}</div>
            </div>
            <div className="uk-row__right">
              {u.paid ? (
                <span className="uk-tag uk-tag--paid"><Crown size={12} /> {u.tierName || 'Платный'}</span>
              ) : (
                <span className="uk-tag">Бесплатный</span>
              )}
              {u.paid && u.subscriptionUntil && <div className="uk-row__until">до {fmt(u.subscriptionUntil)}</div>}
            </div>
            <ChevronRight size={16} className="uk-row__chev" />
          </button>
        ))}
      </div>
    )
  )

  const timeline = (
    evLoading ? (
      <div className="uk-empty"><Loader2 size={18} className="spin" /> Загрузка…</div>
    ) : evError ? (
      <div className="settings__err">{evError}</div>
    ) : !events || events.length === 0 ? (
      <div className="uk-empty">Действий пока нет.<br />Журнал наполняется с момента запуска.</div>
    ) : (
      <div className="uk-tl">
        {events.map((e, i) => {
          const cfg = ACTIONS[e.action] || { icon: Eye, verb: e.action }
          const Icon = cfg.icon
          const showDay = i === 0 || dayLabel(e.at) !== dayLabel(events[i - 1].at)
          const emoji = e.meta?.emoji ? ` ${e.meta.emoji}` : ''
          return (
            <React.Fragment key={e.id}>
              {showDay && <div className="uk-tl__day">{dayLabel(e.at)}</div>}
              <div className="uk-tl__row">
                <span className="uk-tl__icon"><Icon size={14} /></span>
                <div className="uk-tl__body">
                  <div className="uk-tl__text">
                    {cfg.verb}{emoji}
                    {cfg.withTarget && e.targetTitle && (
                      e.targetUrl ? (
                        <> «<a href={e.targetUrl} target="_blank" rel="noopener noreferrer" className="uk-tl__link">{e.targetTitle}</a>»</>
                      ) : (
                        <> «{e.targetTitle}»</>
                      )
                    )}
                  </div>
                  {e.meta?.preview && <div className="uk-tl__preview">{e.meta.preview}</div>}
                </div>
                <time className="uk-tl__time" title={new Date(e.at).toLocaleString('ru-RU')}>{fmtTime(e.at)}</time>
              </div>
            </React.Fragment>
          )
        })}
      </div>
    )
  )

  const drawer = (
    <div className="uk-overlay" role="dialog" aria-modal="true" onClick={closeAll}>
      <div className="uk-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="uk-drawer__head">
          {selected ? (
            <>
              <button className="catmgr__icon-btn" onClick={() => setSelected(null)} aria-label="Назад"><ChevronLeft size={18} /></button>
              <div className="uk-drawer__headmain">
                <h3>{selected.displayName || selected.email}</h3>
                <div className="uk-drawer__sub">{selected.displayName ? selected.email : 'Действия пользователя'}</div>
              </div>
            </>
          ) : (
            <div>
              <h3>Пользователи</h3>
              <div className="uk-drawer__sub">Всего: {users ? users.length : registered}</div>
            </div>
          )}
          <button className="catmgr__icon-btn" onClick={closeAll} aria-label="Закрыть"><X size={18} /></button>
        </div>
        <div className="uk-drawer__body">
          {selected ? timeline : (
            loading ? <div className="uk-empty"><Loader2 size={18} className="spin" /> Загрузка…</div>
            : error ? <div className="settings__err">{error}</div>
            : list
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
