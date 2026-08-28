'use client'

import React, { useState } from 'react'
import { Loader2 } from 'lucide-react'

/**
 * Кнопка «Оформить»: создаёт платёж (POST /api/pay/subscribe) и уводит на
 * хостинговую страницу оплаты ЮKassa. Гостя отправляем на вход. Карту вводит
 * пользователь на стороне ЮKassa — мы её не касаемся.
 */
export function SubscribeButton({ tierId, className }: { tierId: string | number; className?: string }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function go() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/pay/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ tierId }),
      })
      const j = await res.json().catch(() => ({}))
      if (res.status === 401 || j?.needAuth) {
        window.location.href = `/login?next=${encodeURIComponent('/subscribe')}`
        return
      }
      if (!res.ok || j?.error) {
        setError(j.error || 'Не удалось создать платёж')
        setBusy(false)
        return
      }
      if (j.confirmationUrl) {
        window.location.href = j.confirmationUrl
        return
      }
      setError('ЮKassa не вернула ссылку на оплату')
      setBusy(false)
    } catch {
      setError('Ошибка соединения')
      setBusy(false)
    }
  }

  return (
    <>
      <button type="button" className={className} onClick={go} disabled={busy} style={{ marginTop: 'auto' }}>
        {busy ? <Loader2 size={16} className="animate-spin" /> : null} Оформить
      </button>
      {error && (
        <p style={{ color: 'var(--danger, #dc2626)', fontSize: 13, marginTop: 8, textAlign: 'center' }}>{error}</p>
      )}
    </>
  )
}
