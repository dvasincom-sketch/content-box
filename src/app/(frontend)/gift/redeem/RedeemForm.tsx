'use client'

import React, { useState } from 'react'
import { Loader2, Gift, Check } from 'lucide-react'

/** Форма активации подарочного промокода. */
export function RedeemForm({ initialCode }: { initialCode?: string }) {
  const [code, setCode] = useState(initialCode || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<{ tierName: string; months: number } | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!code.trim() || busy) return
    setBusy(true); setError(null)
    try {
      const res = await fetch('/api/gift/redeem', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ code: code.trim() }),
      })
      const j = await res.json().catch(() => ({}))
      if (res.status === 401 || j?.needAuth) {
        window.location.href = `/login?next=${encodeURIComponent('/gift/redeem?code=' + encodeURIComponent(code.trim()))}`
        return
      }
      if (!res.ok || j?.error) { setError(j.error || 'Не удалось активировать'); setBusy(false); return }
      setDone({ tierName: j.tierName, months: j.months })
    } catch { setError('Ошибка соединения'); setBusy(false) }
  }

  if (done) {
    return (
      <div className="c-card" style={{ padding: 28, textAlign: 'center' }}>
        <span style={{ display: 'inline-grid', placeItems: 'center', width: 56, height: 56, borderRadius: 16, marginBottom: 14, background: 'color-mix(in srgb, var(--brand-primary) 12%, transparent)', color: 'var(--brand-primary)' }}>
          <Check size={26} />
        </span>
        <h1 style={{ fontSize: 22, color: 'var(--brand-text)', marginBottom: 8 }}>Подарок активирован!</h1>
        <p style={{ color: 'var(--brand-muted)' }}>Подписка «{done.tierName}» на {done.months} мес добавлена к вашему аккаунту.</p>
        <a href="/account/subscription" className="c-btn c-btn--primary" style={{ marginTop: 16 }}>Моя подписка</a>
      </div>
    )
  }

  return (
    <form className="c-card" style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 14 }} onSubmit={submit}>
      <span style={{ display: 'inline-grid', placeItems: 'center', width: 56, height: 56, borderRadius: 16, background: 'color-mix(in srgb, var(--brand-primary) 12%, transparent)', color: 'var(--brand-primary)' }}>
        <Gift size={26} />
      </span>
      <h1 style={{ fontSize: 22, color: 'var(--brand-text)' }}>Активировать подарок</h1>
      <p style={{ color: 'var(--brand-muted)', fontSize: 14 }}>Введите промокод из письма — подписка добавится к вашему аккаунту.</p>
      <input className="c-input" placeholder="GIFT-XXXXXXXX" value={code} onChange={(e) => setCode(e.target.value)} style={{ textTransform: 'uppercase' }} />
      {error && <p style={{ color: 'var(--danger, #dc2626)', fontSize: 13 }}>{error}</p>}
      <button className="c-btn c-btn--primary" disabled={busy || !code.trim()}>
        {busy ? <Loader2 size={16} className="animate-spin" /> : null} Активировать
      </button>
    </form>
  )
}
