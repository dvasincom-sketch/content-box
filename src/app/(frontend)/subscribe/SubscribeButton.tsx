'use client'

import React, { useState } from 'react'
import { Loader2, Check } from 'lucide-react'
import type { SubChangePlan } from '@/lib/subscriptionChange'

const fmt = (n: number) => new Intl.NumberFormat('ru-RU').format(Math.round(n || 0))

/**
 * Кнопка оформления/смены уровня. Вид зависит от плана (см. lib/subscriptionChange):
 *  • initial  — «Оформить» → оплата на ЮKassa.
 *  • same     — «Уже есть подписка» (неактивна).
 *  • upgrade  — «Повысить · +N ₽» → оплата разницы на ЮKassa.
 *  • downgrade — две опции: «Перейти сейчас» (переключение с перерасчётом, без
 *                оплаты) и «Со следующего периода» (планирование). Обе без ЮKassa.
 * Гостя уводим на вход и возвращаем на ту же страницу (с ?tier=…).
 */
export function SubscribeButton({ tierId, plan, className }: { tierId: string | number; plan: SubChangePlan; className?: string }) {
  const [busy, setBusy] = useState<null | 'pay' | 'now' | 'next'>(null)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  async function go(kind: 'pay' | 'now' | 'next') {
    setBusy(kind)
    setError(null)
    try {
      const res = await fetch('/api/pay/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(kind === 'pay' ? { tierId } : { tierId, mode: kind === 'now' ? 'now' : 'next' }),
      })
      const j = await res.json().catch(() => ({}))
      if (res.status === 401 || j?.needAuth) {
        const back = window.location.pathname + window.location.search
        window.location.href = `/login?next=${encodeURIComponent(back)}`
        return
      }
      if (!res.ok || j?.error) {
        setError(j.error || 'Не удалось выполнить операцию')
        setBusy(null)
        return
      }
      if (j.confirmationUrl) { window.location.href = j.confirmationUrl; return }
      if (j.switched) { window.location.href = '/account/subscription?switched=1'; return }
      if (j.scheduled) {
        const d = j.until ? new Date(j.until).toLocaleDateString('ru-RU') : null
        setDone(d ? `Смена запланирована с ${d}` : 'Смена запланирована')
        setBusy(null)
        return
      }
      setError('Не удалось выполнить операцию')
      setBusy(null)
    } catch {
      setError('Ошибка соединения')
      setBusy(null)
    }
  }

  if (done) {
    return (
      <p style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 'auto', color: 'var(--brand-primary)', fontSize: 14, fontWeight: 600 }}>
        <Check size={16} /> {done}
      </p>
    )
  }

  // «Уже есть эта подписка»
  if (plan.kind === 'same') {
    return (
      <button type="button" className={className} disabled style={{ marginTop: 'auto', opacity: 0.7, cursor: 'default' }}>
        Уже есть подписка
      </button>
    )
  }

  // Понижение — две опции
  if (plan.kind === 'downgrade') {
    return (
      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button type="button" className={className} onClick={() => go('now')} disabled={busy !== null} style={{ marginTop: 0 }}>
          {busy === 'now' ? <Loader2 size={16} className="animate-spin" /> : null} Перейти сейчас
        </button>
        <button
          type="button"
          onClick={() => go('next')}
          disabled={busy !== null}
          style={{ background: 'none', border: 'none', color: 'var(--brand-muted)', fontSize: 13, textDecoration: 'underline', cursor: 'pointer' }}
        >
          {busy === 'next' ? 'Планирование…' : 'или со следующего периода'}
        </button>
        <p style={{ fontSize: 12, lineHeight: 1.4, color: 'var(--brand-muted)', textAlign: 'center', margin: 0 }}>
          «Сейчас» — переключим сразу, остаток пойдёт в доп. дни по новой цене. Без списания.
        </p>
        {error && <p style={{ color: 'var(--danger, #dc2626)', fontSize: 13, textAlign: 'center', margin: 0 }}>{error}</p>}
      </div>
    )
  }

  // initial / upgrade — оплата на ЮKassa
  const label = plan.kind === 'upgrade' ? `Повысить · +${fmt(plan.amountRub)} ₽` : 'Оформить'

  return (
    <>
      <button type="button" className={className} onClick={() => go('pay')} disabled={busy !== null} style={{ marginTop: 'auto' }}>
        {busy === 'pay' ? <Loader2 size={16} className="animate-spin" /> : null} {label}
      </button>
      {plan.kind === 'upgrade' && (
        <p style={{ fontSize: 12, lineHeight: 1.4, color: 'var(--brand-muted)', textAlign: 'center', marginTop: 6 }}>
          Доплата за оставшиеся дни. Дата окончания не изменится.
        </p>
      )}
      {error && (
        <p style={{ color: 'var(--danger, #dc2626)', fontSize: 13, marginTop: 8, textAlign: 'center' }}>{error}</p>
      )}
    </>
  )
}
