'use client'

import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Heart, X, Loader2 } from 'lucide-react'

type Preset = { amount: number; label?: string }

const DEFAULT_PRESETS: Preset[] = [
  { amount: 300, label: 'кофе автору' },
  { amount: 500, label: 'спасибо' },
  { amount: 1000, label: 'щедро' },
  { amount: 2000, label: 'меценат' },
]

const rub = (n: number) => `${n.toLocaleString('ru-RU')} ₽`

/**
 * Кнопка «Поддержать» + всплывающее окно доната прямо на странице трансляции.
 * Без перехода на отдельную страницу: сумма → /api/pay/donate → редирект на
 * оплату ЮKassa. Высокая конверсия — минимум полей.
 */
export function StreamDonate({ presets, compact }: { presets?: Preset[]; compact?: boolean }) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  return (
    <>
      <button
        type="button"
        className="c-btn c-btn--primary"
        onClick={() => setOpen(true)}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', padding: compact ? '6px 10px' : undefined, fontSize: compact ? 13 : undefined }}
      >
        <Heart size={compact ? 14 : 16} fill="currentColor" /> Поддержать
      </button>
      {open && mounted &&
        createPortal(
          <DonateModal presets={presets && presets.length ? presets : DEFAULT_PRESETS} onClose={() => setOpen(false)} />,
          document.body,
        )}
    </>
  )
}

function DonateModal({ presets, onClose }: { presets: Preset[]; onClose: () => void }) {
  const [amount, setAmount] = useState<number>(presets[1]?.amount || presets[0]?.amount || 500)
  const [custom, setCustom] = useState('')
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState('')
  const [anon, setAnon] = useState(false)
  const [needEmail, setNeedEmail] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const eff = custom.trim() ? Math.floor(Number(custom.replace(/\D/g, '')) || 0) : amount

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (eff <= 0 || busy) return
    setBusy(true); setError(null)
    try {
      const res = await fetch('/api/pay/donate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({
          amountRub: eff,
          message: message.trim() || undefined,
          isAnonymous: anon,
          email: email.trim() || undefined,
        }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok || j?.error) {
        if (j?.needEmail) setNeedEmail(true)
        setError(j?.error || 'Не удалось создать платёж')
        setBusy(false)
        return
      }
      if (j.confirmationUrl) { window.location.href = j.confirmationUrl; return }
      setError('Не получилось перейти к оплате')
      setBusy(false)
    } catch { setError('Ошибка соединения'); setBusy(false) }
  }

  const chip = (active: boolean): React.CSSProperties => ({
    padding: '8px 12px', borderRadius: 999, cursor: 'pointer', fontSize: 14, fontWeight: 700,
    border: `1px solid ${active ? 'var(--brand-primary, #ea580c)' : 'var(--brand-border, rgba(0,0,0,.14))'}`,
    background: active ? 'color-mix(in srgb, var(--brand-primary, #ea580c) 14%, transparent)' : 'transparent',
    color: active ? 'var(--brand-primary, #ea580c)' : 'var(--brand-text)',
  })

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', display: 'grid', placeItems: 'center', zIndex: 2000, padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} className="c-card" style={{ width: '100%', maxWidth: 440, borderRadius: 18, padding: 0, overflow: 'hidden', background: 'var(--brand-surface, var(--brand-bg, #fff))' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--brand-border, rgba(0,0,0,.1))' }}>
          <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--brand-text)', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <Heart size={18} fill="var(--brand-primary, #ea580c)" style={{ color: 'var(--brand-primary, #ea580c)' }} /> Поддержать автора
          </div>
          <button type="button" onClick={onClose} aria-label="Закрыть" style={{ border: 0, background: 'transparent', cursor: 'pointer', color: 'var(--brand-muted)' }}><X size={20} /></button>
        </div>

        <form onSubmit={submit} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {presets.map((p) => (
              <button key={p.amount} type="button" style={chip(!custom.trim() && amount === p.amount)} onClick={() => { setCustom(''); setAmount(p.amount) }}>
                {rub(p.amount)}
              </button>
            ))}
          </div>

          <label style={{ display: 'block' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--brand-muted)' }}>Другая сумма, ₽</span>
            <input inputMode="numeric" className="c-input" value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="например, 700" style={{ width: '100%', marginTop: 4 }} />
          </label>

          <label style={{ display: 'block' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--brand-muted)' }}>Сообщение (необязательно)</span>
            <textarea className="c-input" rows={2} maxLength={300} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Пара тёплых слов автору" style={{ width: '100%', marginTop: 4, resize: 'vertical' }} />
          </label>

          {needEmail && (
            <label style={{ display: 'block' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--brand-muted)' }}>E-mail для чека</span>
              <input type="email" className="c-input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" style={{ width: '100%', marginTop: 4 }} />
            </label>
          )}

          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14, color: 'var(--brand-text)', cursor: 'pointer' }}>
            <input type="checkbox" checked={anon} onChange={(e) => setAnon(e.target.checked)} /> Анонимно
          </label>

          {error && <div style={{ color: 'var(--danger, #dc2626)', fontSize: 13 }}>{error}</div>}

          <button type="submit" className="c-btn c-btn--primary" disabled={busy || eff <= 0} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 16px', fontSize: 15, fontWeight: 800 }}>
            {busy ? <Loader2 size={18} className="animate-spin" /> : <Heart size={16} fill="currentColor" />}
            Поддержать на {rub(eff)}
          </button>
          <div style={{ fontSize: 11.5, color: 'var(--brand-muted)', textAlign: 'center' }}>Оплата картой через ЮKassa. Чек придёт на e-mail.</div>
        </form>
      </div>
    </div>
  )
}
