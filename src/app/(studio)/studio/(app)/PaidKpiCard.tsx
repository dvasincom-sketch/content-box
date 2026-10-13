'use client'

import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { CreditCard, X, Loader2, Crown, UserMinus, UserPlus, Clock } from 'lucide-react'

type Row = {
  subscriberId: number | null
  name: string
  email: string
  tierName: string | null
  at: string
  reason?: 'expired' | 'canceled'
  paidNow: boolean
  subscriptionUntil: string | null
}

type Data = { days: number; expiringDays: number; lost: Row[]; started: Row[]; expiring: Row[] }

type Tab = 'lost' | 'started' | 'expiring'

const PERIODS = [7, 30, 90] as const

const fmt = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString('ru-RU', { timeZone: 'Europe/Moscow', day: 'numeric', month: 'short', year: 'numeric' })
    : '—'

/** «через N дн.» для истекающих. */
const inDays = (iso: string) => {
  const d = Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000)
  return d <= 0 ? 'сегодня' : d === 1 ? 'завтра' : `через ${d} дн.`
}

/**
 * KPI-плашка «Платных»: кликабельна, открывает правый drawer с движением
 * платной базы за период (7/30/90 дн.):
 *  - «Ушли» — истёкшие подписки и снятые тарифы (кто снова платный — не здесь);
 *  - «Новые» — оформили платную подписку;
 *  - «Скоро истекают» — активные, у кого подписка кончается в ближайшие 14 дней.
 * Данные — /studio/api/paid-churn (только владелец студии).
 */
export function PaidKpiCard({ paid }: { paid: number }) {
  const [open, setOpen] = useState(false)
  const [days, setDays] = useState<number>(30)
  const [tab, setTab] = useState<Tab>('lost')
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  async function load(d: number) {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/studio/api/paid-churn?days=${d}`, { credentials: 'include' })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) setError(j.error || 'Не удалось загрузить')
      else setData(j as Data)
    } catch {
      setError('Ошибка соединения')
    } finally {
      setLoading(false)
    }
  }

  function openDrawer() {
    setOpen(true)
    if (!data && !loading) load(days)
  }

  function pickDays(d: number) {
    if (d === days) return
    setDays(d)
    load(d)
  }

  // Esc закрывает панель.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const lostN = data?.lost.length ?? 0
  const startedN = data?.started.length ?? 0
  const net = startedN - lostN
  const expiredN = data ? data.lost.filter((r) => r.reason === 'expired').length : 0
  const canceledN = lostN - expiredN

  const chip = (active: boolean): React.CSSProperties => ({
    padding: '5px 12px',
    borderRadius: 999,
    fontSize: 13,
    border: '1px solid var(--st-border)',
    background: active ? 'var(--st-text)' : 'transparent',
    color: active ? 'var(--st-bg, #fff)' : 'var(--st-text)',
    cursor: 'pointer',
  })

  const summary = (label: string, value: string, sub?: string) => (
    <div style={{ flex: 1, minWidth: 0, padding: '10px 12px', borderRadius: 12, border: '1px solid var(--st-border)' }}>
      <div style={{ fontSize: 20, fontWeight: 600, lineHeight: 1.2 }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--st-text-muted)' }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--st-text-muted)', marginTop: 2 }}>{sub}</div>}
    </div>
  )

  const rows = data ? (tab === 'lost' ? data.lost : tab === 'started' ? data.started : data.expiring) : []

  const emptyText =
    tab === 'lost'
      ? `За ${days} дн. никто не ушёл.`
      : tab === 'started'
        ? `За ${days} дн. новых платных нет.`
        : `В ближайшие ${data?.expiringDays ?? 14} дн. подписки ни у кого не истекают.`

  const list =
    rows.length === 0 ? (
      <div className="uk-empty">{emptyText}</div>
    ) : (
      <div className="uk-list">
        {rows.map((r, i) => (
          <div key={`${r.subscriberId ?? 'x'}-${i}`} className="uk-row">
            <span className="uk-ava">{(r.name || '?').slice(0, 1).toUpperCase()}</span>
            <div className="uk-row__main">
              <div className="uk-row__name">{r.name}</div>
              {r.email && r.email !== r.name && <div className="uk-row__email">{r.email}</div>}
              <div className="uk-row__meta">
                {tab === 'lost' &&
                  (r.reason === 'expired' ? `Подписка истекла ${fmt(r.at)}` : `Тариф снят ${fmt(r.at)}`)}
                {tab === 'started' && `Оформил(а) ${fmt(r.at)}`}
                {tab === 'expiring' && `Истекает ${fmt(r.at)} · ${inDays(r.at)}`}
              </div>
            </div>
            <div className="uk-row__right">
              {r.tierName && (
                <span className={`uk-tag${tab === 'lost' ? '' : ' uk-tag--paid'}`}>
                  {tab !== 'lost' && <Crown size={12} />} {r.tierName}
                </span>
              )}
              {tab === 'started' && !r.paidNow && <div className="uk-row__until">уже не платный</div>}
            </div>
          </div>
        ))}
      </div>
    )

  const drawer = (
    <div className="uk-overlay" role="dialog" aria-modal="true" onClick={() => setOpen(false)}>
      <div className="uk-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="uk-drawer__head">
          <div>
            <h3>Платные подписчики</h3>
            <div className="uk-drawer__sub">Сейчас платных: {paid}</div>
          </div>
          <button className="catmgr__icon-btn" onClick={() => setOpen(false)} aria-label="Закрыть">
            <X size={18} />
          </button>
        </div>
        <div className="uk-drawer__body">
          {/* Период */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            {PERIODS.map((d) => (
              <button key={d} type="button" style={chip(d === days)} onClick={() => pickDays(d)} disabled={loading}>
                {d} дней
              </button>
            ))}
          </div>

          {loading && !data ? (
            <div className="uk-empty">
              <Loader2 size={18} className="spin" /> Загрузка…
            </div>
          ) : error ? (
            <div className="settings__err">{error}</div>
          ) : data ? (
            <div style={{ opacity: loading ? 0.5 : 1, transition: 'opacity .15s' }}>
              {/* Сводка за период */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                {summary('Новых', `+${startedN}`)}
                {summary(
                  'Ушли',
                  `−${lostN}`,
                  lostN > 0 ? `истекло ${expiredN}${canceledN ? ` · снято ${canceledN}` : ''}` : undefined,
                )}
                {summary('Итого', `${net > 0 ? '+' : net < 0 ? '−' : ''}${Math.abs(net)}`)}
              </div>

              {/* Вкладки */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
                <button type="button" style={chip(tab === 'lost')} onClick={() => setTab('lost')}>
                  <UserMinus size={13} style={{ verticalAlign: '-2px' }} /> Ушли ({lostN})
                </button>
                <button type="button" style={chip(tab === 'started')} onClick={() => setTab('started')}>
                  <UserPlus size={13} style={{ verticalAlign: '-2px' }} /> Новые ({startedN})
                </button>
                <button type="button" style={chip(tab === 'expiring')} onClick={() => setTab('expiring')}>
                  <Clock size={13} style={{ verticalAlign: '-2px' }} /> Скоро истекают ({data.expiring.length})
                </button>
              </div>

              {list}

              {tab === 'expiring' && data.expiring.length > 0 && (
                <p style={{ fontSize: 12, color: 'var(--st-text-muted)', marginTop: 10 }}>
                  Подписки, которые закончатся в ближайшие {data.expiringDays} дней, — им можно напомнить о продлении.
                </p>
              )}
              {tab === 'started' && (
                <p style={{ fontSize: 12, color: 'var(--st-text-muted)', marginTop: 10 }}>
                  Новые оформления считаются по журналу событий подписок — он ведётся с его запуска.
                </p>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )

  return (
    <>
      <button type="button" className="dash__kpi dash__kpi--click" onClick={openDrawer} title="Кто пришёл и кто ушёл">
        <div className="dash__kpi-icon">
          <CreditCard size={16} />
        </div>
        <div className="dash__kpi-body">
          <div className="dash__kpi-value">{paid}</div>
          <div className="dash__kpi-label">Платных</div>
        </div>
      </button>
      {mounted && open && createPortal(drawer, document.body)}
    </>
  )
}
