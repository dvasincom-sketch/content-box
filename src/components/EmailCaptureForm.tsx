'use client'

import React, { useState } from 'react'

/**
 * Форма ввода/смены email подписчика. POST /account/api/email → письмо со ссылкой
 * подтверждения. Переиспользуется в: сквозном баннере, кабинете и шаге сразу
 * после регистрации по телефону. Требует активной сессии подписчика (после входа
 * по SMS кука уже стоит).
 */
export function EmailCaptureForm({
  initialEmail = '',
  submitLabel = 'Сохранить и подтвердить',
  onSent,
  compact = false,
}: {
  initialEmail?: string
  submitLabel?: string
  onSent?: (email: string) => void
  compact?: boolean
}) {
  const [email, setEmail] = useState(initialEmail)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sentTo, setSentTo] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const res = await fetch('/account/api/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(j.error || 'Не удалось сохранить email')
        setBusy(false)
        return
      }
      const savedEmail = (j.email as string) || email.trim().toLowerCase()
      setSentTo(savedEmail)
      setBusy(false)
      onSent?.(savedEmail)
    } catch {
      setError('Ошибка соединения')
      setBusy(false)
    }
  }

  if (sentTo) {
    return (
      <div style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--brand-text)' }}>
        Письмо со ссылкой подтверждения отправлено на <b>{sentTo}</b>. Откройте его и подтвердите адрес.
        <button
          type="button"
          onClick={() => setSentTo(null)}
          style={{ marginLeft: 8, background: 'none', border: 'none', color: 'var(--brand-primary)', cursor: 'pointer', textDecoration: 'underline', padding: 0, fontSize: 14 }}
        >
          Изменить адрес
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-start' }}>
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="your@email.com"
        autoComplete="email"
        className="c-input"
        style={{ flex: compact ? '1 1 220px' : '1 1 260px', minWidth: 200, padding: '10px 12px', borderRadius: 10, border: '1px solid color-mix(in srgb, var(--brand-text) 22%, transparent)', background: 'var(--brand-bg)', color: 'var(--brand-text)', fontSize: 15 }}
      />
      <button
        type="submit"
        disabled={busy}
        className="c-btn c-btn--primary c-btn--pill"
        style={{ whiteSpace: 'nowrap' }}
      >
        {busy ? 'Отправляем…' : submitLabel}
      </button>
      {error && <div style={{ flexBasis: '100%', color: '#dc2626', fontSize: 13 }}>{error}</div>}
    </form>
  )
}
