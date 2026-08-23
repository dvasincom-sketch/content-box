'use client'

import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Star, CreditCard, CalendarClock, CalendarCheck, AlertCircle, X, Loader2 } from 'lucide-react'

type Payment = { id: string | number; date: string | null; amountRub: number; status: string }

const STATUS_LABEL: Record<string, string> = {
  succeeded: 'Оплачено',
  pending: 'Ожидает',
  canceled: 'Отменён',
  refunded: 'Возврат',
}
const STATUS_COLOR: Record<string, string> = {
  succeeded: 'var(--brand-primary)',
  pending: 'var(--brand-muted)',
  canceled: '#e5484d',
  refunded: '#e5484d',
}

function fmtDate(iso?: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch {
    return '—'
  }
}

export function MySubscription({
  planName,
  priceRub,
  activeUntil,
  autoRenew,
  cardLabel,
  subscriptionSince,
  payments,
}: {
  planName: string | null
  priceRub: number | null
  activeUntil: string | null
  autoRenew: boolean
  cardLabel: string | null
  subscriptionSince: string | null
  payments: Payment[]
}) {
  const router = useRouter()
  const [renew, setRenew] = useState(autoRenew)
  const [modal, setModal] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function cancel() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/pay/cancel', { method: 'POST', credentials: 'include' })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) setError(j.error || 'Не удалось отменить')
      else {
        setRenew(false)
        setModal(false)
        router.refresh()
      }
    } catch {
      setError('Ошибка соединения')
    } finally {
      setBusy(false)
    }
  }

  if (!planName) {
    return (
      <div className="c-card" style={{ padding: 24, textAlign: 'center' }}>
        <div style={{ color: 'var(--brand-muted)', marginBottom: 14 }}>У вас пока нет активной подписки.</div>
        <Link href="/subscribe" className="c-btn c-btn--primary">Оформить подписку</Link>
      </div>
    )
  }

  return (
    <>
      {/* Карточка плана */}
      <div className="c-card" style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' }}>
          <span style={{ width: 44, height: 44, borderRadius: 12, background: 'color-mix(in srgb, var(--brand-primary) 18%, transparent)', color: 'var(--brand-primary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
            <Star size={22} />
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--brand-text)' }}>{planName}</div>
            {priceRub ? <div style={{ fontSize: 13, color: 'var(--brand-muted)', marginTop: 2 }}>{priceRub} ₽ / мес</div> : null}
          </div>
          <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--brand-primary)', background: 'color-mix(in srgb, var(--brand-primary) 14%, transparent)', padding: '6px 12px', borderRadius: 999 }}>
            <CalendarCheck size={15} /> Активна до {fmtDate(activeUntil)}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
          <Link href="/subscribe" className="c-btn c-btn--primary">Изменить план</Link>
          {renew && (
            <button type="button" className="c-btn c-btn--surface" onClick={() => setModal(true)}>Отменить подписку</button>
          )}
        </div>
        {!renew && (
          <div style={{ marginTop: 12, fontSize: 13, color: 'var(--brand-muted)' }}>
            Автопродление выключено — доступ сохранится до {fmtDate(activeUntil)}.
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
        {/* Информация */}
        <div className="c-card" style={{ padding: 20 }}>
          <h2 style={{ fontSize: 16, color: 'var(--brand-text)', margin: '0 0 14px' }}>Информация о подписке</h2>
          <InfoRow icon={<CalendarCheck size={16} />} label="Дата оформления" value={fmtDate(subscriptionSince)} />
          <InfoRow icon={<CalendarClock size={16} />} label="Следующее списание" value={renew ? fmtDate(activeUntil) : 'не продлевается'} />
          <InfoRow icon={<CreditCard size={16} />} label="Способ оплаты" value={cardLabel || '—'} last />
        </div>

        {/* История платежей */}
        <div className="c-card" style={{ padding: 20 }}>
          <h2 style={{ fontSize: 16, color: 'var(--brand-text)', margin: '0 0 14px' }}>История платежей</h2>
          {payments.length === 0 ? (
            <div style={{ color: 'var(--brand-muted)', fontSize: 14 }}>Платежей пока нет.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {payments.map((p, i) => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '10px 0', borderTop: i === 0 ? 'none' : '1px solid var(--brand-border, rgba(128,128,128,.15))' }}>
                  <span style={{ color: 'var(--brand-text)', fontSize: 14 }}>{fmtDate(p.date)}</span>
                  <span style={{ color: 'var(--brand-text)', fontWeight: 600, fontSize: 14 }}>{p.amountRub} ₽</span>
                  <span style={{ color: STATUS_COLOR[p.status] || 'var(--brand-muted)', fontSize: 13, minWidth: 90, textAlign: 'right' }}>
                    {STATUS_LABEL[p.status] || p.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {modal && <CancelModal activeUntil={activeUntil} cardLabel={cardLabel} busy={busy} error={error} onClose={() => setModal(false)} onConfirm={cancel} />}
    </>
  )
}

function InfoRow({ icon, label, value, last }: { icon: React.ReactNode; label: string; value: string; last?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: last ? 'none' : '1px solid var(--brand-border, rgba(128,128,128,.15))' }}>
      <span style={{ color: 'var(--brand-muted)', flex: 'none' }}>{icon}</span>
      <span style={{ color: 'var(--brand-muted)', fontSize: 14 }}>{label}</span>
      <span style={{ marginLeft: 'auto', color: 'var(--brand-text)', fontSize: 14, fontWeight: 600, textAlign: 'right' }}>{value}</span>
    </div>
  )
}

function CancelModal({
  activeUntil, cardLabel, busy, error, onClose, onConfirm,
}: {
  activeUntil: string | null
  cardLabel: string | null
  busy: boolean
  error: string | null
  onClose: () => void
  onConfirm: () => void
}) {
  if (typeof document === 'undefined') return null
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 1000 }}
    >
      <div className="c-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420, width: '100%', padding: 24, position: 'relative', textAlign: 'center' }}>
        <button type="button" onClick={onClose} aria-label="Закрыть" style={{ position: 'absolute', top: 12, right: 12, background: 'none', border: 0, cursor: 'pointer', color: 'var(--brand-muted)' }}>
          <X size={18} />
        </button>
        <span style={{ width: 48, height: 48, borderRadius: 999, background: 'color-mix(in srgb, #e5484d 16%, transparent)', color: '#e5484d', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
          <AlertCircle size={24} />
        </span>
        <h3 style={{ fontSize: 18, color: 'var(--brand-text)', margin: '0 0 6px' }}>Отмена подписки</h3>
        <p style={{ color: 'var(--brand-muted)', fontSize: 14, margin: '0 0 16px' }}>Уверены, что хотите отменить подписку?</p>

        {cardLabel && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', border: '1px solid var(--brand-border, rgba(128,128,128,.2))', borderRadius: 10, padding: '10px 12px', marginBottom: 12 }}>
            <CreditCard size={18} style={{ color: 'var(--brand-muted)' }} />
            <div>
              <div style={{ fontSize: 12, color: 'var(--brand-muted)' }}>Способ оплаты</div>
              <div style={{ fontSize: 14, color: 'var(--brand-text)', fontWeight: 600 }}>{cardLabel}</div>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', textAlign: 'left', background: 'color-mix(in srgb, #e5484d 8%, transparent)', borderRadius: 10, padding: '10px 12px', marginBottom: 18 }}>
          <AlertCircle size={16} style={{ color: '#e5484d', flex: 'none', marginTop: 2 }} />
          <span style={{ fontSize: 13, color: 'var(--brand-muted)' }}>
            После отмены доступ к контенту сохранится до окончания оплаченного периода — <b style={{ color: 'var(--brand-text)' }}>{fmtDate(activeUntil)}</b>.
          </span>
        </div>

        {error && <div style={{ color: '#e5484d', fontSize: 13, marginBottom: 10 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" className="c-btn" onClick={onConfirm} disabled={busy} style={{ flex: 1, background: '#e5484d', color: '#fff', borderColor: '#e5484d' }}>
            {busy ? <Loader2 size={15} className="spin" /> : 'Отменить подписку'}
          </button>
          <button type="button" className="c-btn c-btn--surface" onClick={onClose} disabled={busy} style={{ flex: 1 }}>Назад</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
