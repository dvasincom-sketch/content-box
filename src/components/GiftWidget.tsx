'use client'

import React, { useState } from 'react'
import { Gift, X, ChevronLeft, ChevronRight } from 'lucide-react'

export type GiftTier = { id: number | string; name: string; priceRub: number; description?: string }

const fmt = (n: number) => new Intl.NumberFormat('ru-RU').format(Math.round(n || 0))
const rub = (n: number) => `${fmt(n)} ₽`
const PERIODS = [1, 3, 6, 12]

/**
 * Виджет покупки подарочной подписки. Режимы триггера:
 *  - 'segment' — переключатель «Себе / В подарок» (для /subscribe)
 *  - 'button'  — крупная кнопка «Подарить подписку» (для лендинга /gift)
 * Оплата отложена: по «Купить в подарок» показываем экран «скоро через YooKassa».
 */
export function GiftWidget({ tiers, mode = 'button', selfHref = '/subscribe', giftHref = '/gift', label = 'Подарить подписку' }: {
  tiers: GiftTier[]
  mode?: 'segment' | 'button'
  selfHref?: string
  giftHref?: string
  label?: string
}) {
  const [open, setOpen] = useState(false)
  const giftable = tiers.filter((t) => t.priceRub > 0)

  return (
    <>
      {mode === 'segment' ? (
        <div className="gift-seg" role="group" aria-label="Кому оформляем">
          <a href={selfHref} className="gift-seg__btn is-active">Себе</a>
          <a href={giftHref} className="gift-seg__btn"><Gift size={16} /> В подарок</a>
        </div>
      ) : (
        <button type="button" className="dn-btn dn-btn--primary dn-btn--lg" onClick={() => setOpen(true)}>
          <Gift size={18} /> {label}
        </button>
      )}
      {open && <GiftModal tiers={giftable} onClose={() => setOpen(false)} />}
    </>
  )
}

function GiftModal({ tiers, onClose }: { tiers: GiftTier[]; onClose: () => void }) {
  const [idx, setIdx] = useState(0)
  const [months, setMonths] = useState(1)
  const [email, setEmail] = useState('')
  const [buyerName, setBuyerName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const tier = tiers[idx]
  const total = tier ? tier.priceRub * months : 0
  const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())

  async function buy() {
    if (!tier || !emailOk || busy) return
    setBusy(true); setError(null)
    try {
      const res = await fetch('/api/pay/gift', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ tierId: tier.id, months, recipientEmail: email.trim(), buyerName: buyerName.trim() || undefined }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok || j?.error) { setError(j.error || 'Не удалось создать платёж'); setBusy(false); return }
      if (j.confirmationUrl) { window.location.href = j.confirmationUrl; return }
      setError('ЮKassa не вернула ссылку на оплату'); setBusy(false)
    } catch { setError('Ошибка соединения'); setBusy(false) }
  }

  if (!tier) {
    return (
      <Shell onClose={onClose}>
        <p className="gift-empty">Пока нет платных уровней для подарка. Добавьте тариф в студии.</p>
      </Shell>
    )
  }

  return (
    <Shell onClose={onClose} title="Покупка подарочной подписки">
      <div className="gift-row gift-row--head">
        <label className="gift-label">Какой уровень будем дарить?</label>
        <div className="gift-nav">
          <button type="button" onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0} aria-label="Назад"><ChevronLeft size={18} /></button>
          <button type="button" onClick={() => setIdx((i) => Math.min(tiers.length - 1, i + 1))} disabled={idx >= tiers.length - 1} aria-label="Далее"><ChevronRight size={18} /></button>
        </div>
      </div>
      <div className="gift-tier">
        <div className="gift-tier__name">{tier.name}</div>
        <div className="gift-tier__price">{rub(tier.priceRub)} <span>в месяц</span></div>
        {tier.description && <div className="gift-tier__desc">{tier.description}</div>}
        {tiers.length > 1 && <div className="gift-dots">{tiers.map((_, i) => <span key={i} className={i === idx ? 'is-on' : ''} />)}</div>}
      </div>

      <label className="gift-label">Период подписки</label>
      <div className="gift-periods">
        {PERIODS.map((p) => (
          <button type="button" key={p} className={'gift-chip' + (months === p ? ' is-active' : '')} onClick={() => setMonths(p)}>{p} мес</button>
        ))}
      </div>

      <label className="gift-label" style={{ marginTop: 12 }}>E-mail получателя</label>
      <input className="dn-input" type="email" placeholder="friend@mail.ru" value={email} onChange={(e) => setEmail(e.target.value)} />
      <p className="gift-hint">На эту почту придёт промокод. Получатель активирует его на сайте.</p>

      <label className="gift-label">От кого (необязательно)</label>
      <input className="dn-input" placeholder="Ваше имя" value={buyerName} onChange={(e) => setBuyerName(e.target.value)} />

      <div className="gift-total">
        <div className="gift-total__label">К оплате:</div>
        <div className="gift-total__sum">{rub(total)} <span>({months} мес)</span></div>
        <p className="gift-total__note">Оплата сразу за выбранный период. Продление — по желанию получателя.</p>
      </div>

      {error && <p style={{ color: 'var(--danger, #dc2626)', fontSize: 13, textAlign: 'center', marginBottom: 8 }}>{error}</p>}
      <button type="button" className="dn-btn dn-btn--primary dn-btn--lg dn-btn--block" onClick={buy} disabled={busy || !emailOk}>
        <Gift size={18} /> {busy ? 'Переход к оплате…' : 'Купить в подарок'}
      </button>
    </Shell>
  )
}

function Shell({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title?: string }) {
  return (
    <div className="gift-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="gift-box" onClick={(e) => e.stopPropagation()}>
        <div className="gift-box__head">
          <h2>{title || 'Подарочная подписка'}</h2>
          <button className="gift-x" onClick={onClose} aria-label="Закрыть"><X size={20} /></button>
        </div>
        <div className="gift-box__body">{children}</div>
      </div>
    </div>
  )
}
