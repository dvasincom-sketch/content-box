'use client'

import React, { useMemo, useState } from 'react'
import { Gift, X, Minus, Plus, ChevronLeft, ChevronRight } from 'lucide-react'

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
  const [qty, setQty] = useState(1)
  const [recipMode, setRecipMode] = useState<'fields' | 'csv'>('fields')
  const [emails, setEmails] = useState<string[]>([''])
  const [csv, setCsv] = useState('')
  const [anon, setAnon] = useState(false)
  const [done, setDone] = useState(false)

  const tier = tiers[idx]
  const total = tier ? tier.priceRub * months * qty : 0

  // Кол-во строк email = количеству подарков
  const emailFields = useMemo(() => {
    const arr = [...emails]
    while (arr.length < qty) arr.push('')
    return arr.slice(0, qty)
  }, [emails, qty])

  function setEmail(i: number, v: string) {
    setEmails((prev) => {
      const arr = [...prev]
      while (arr.length < qty) arr.push('')
      arr[i] = v
      return arr.slice(0, qty)
    })
  }
  function changeQty(d: number) { setQty((q) => Math.max(1, Math.min(20, q + d))) }

  if (!tier) {
    return (
      <Shell onClose={onClose}>
        <p className="gift-empty">Пока нет платных уровней для подарка. Добавьте тариф в студии.</p>
      </Shell>
    )
  }

  if (done) {
    return (
      <Shell onClose={onClose} title="Почти готово 🎁">
        <div className="gift-thanks">
          <span className="dn-ava dn-ava--lg"><Gift size={26} /></span>
          <h3 className="dn-modal__title">Спасибо! Оплата подарка скоро заработает</h3>
          <p className="dn-modal__text">
            Приём оплаты через YooKassa сейчас подключается. Как только запустим — вы сможете
            оплатить подарок «{tier.name}» ({months} мес × {qty}) на {rub(total)} и получить
            ссылку для отправки получателю.
          </p>
          <button className="dn-btn dn-btn--primary dn-btn--block" onClick={onClose}>Понятно</button>
        </div>
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

      <div className="gift-grid2">
        <div>
          <label className="gift-label">Период подписки</label>
          <div className="gift-periods">
            {PERIODS.map((p) => (
              <button type="button" key={p} className={'gift-chip' + (months === p ? ' is-active' : '')} onClick={() => setMonths(p)}>{p} мес</button>
            ))}
          </div>
        </div>
        <div>
          <label className="gift-label">Количество</label>
          <div className="gift-qty">
            <button type="button" onClick={() => changeQty(-1)} aria-label="Меньше"><Minus size={16} /></button>
            <span>{qty}</span>
            <button type="button" onClick={() => changeQty(1)} aria-label="Больше"><Plus size={16} /></button>
          </div>
        </div>
      </div>

      <div className="gift-row gift-row--head">
        <label className="gift-label">Кому будем дарить?</label>
        <div className="gift-toggle">
          <button type="button" className={recipMode === 'fields' ? 'is-active' : ''} onClick={() => setRecipMode('fields')}>Отдельными полями</button>
          <button type="button" className={recipMode === 'csv' ? 'is-active' : ''} onClick={() => setRecipMode('csv')}>Через запятую</button>
        </div>
      </div>
      {recipMode === 'fields' ? (
        <div className="gift-emails">
          {emailFields.map((e, i) => (
            <input key={i} className="dn-input" type="email" placeholder={`E-mail получателя${qty > 1 ? ` #${i + 1}` : ''}`} value={e} onChange={(ev) => setEmail(i, ev.target.value)} />
          ))}
        </div>
      ) : (
        <textarea className="dn-input" rows={2} placeholder="email1@mail.ru, email2@mail.ru" value={csv} onChange={(e) => setCsv(e.target.value)} />
      )}
      <p className="gift-hint">Получателей можно указать позже — ссылку для отправки подарка вы получите в разделе «Мои подписки».</p>

      <label className="gift-anon">
        <span>Отправить анонимно</span>
        <input type="checkbox" checked={anon} onChange={(e) => setAnon(e.target.checked)} />
      </label>

      <div className="gift-total">
        <div className="gift-total__label">К оплате:</div>
        <div className="gift-total__sum">{rub(total)} <span>({months} мес × {qty})</span></div>
        <p className="gift-total__note">Оплата сразу за выбранный период. Продление — по желанию получателя.</p>
      </div>

      <button type="button" className="dn-btn dn-btn--primary dn-btn--lg dn-btn--block" onClick={() => setDone(true)}>
        <Gift size={18} /> Купить в подарок
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
