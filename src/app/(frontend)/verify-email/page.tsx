'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

/**
 * Подтверждение email подписчика по ссылке из письма (/verify-email?token=…).
 *
 * Токен читаем из query и сразу отправляем на /api/verify-email. Мягкий режим:
 * страница ничего не блокирует — просто показывает результат. Токен берём из
 * window.location, чтобы не тянуть useSearchParams (Suspense в билде).
 */
type State = 'checking' | 'ok' | 'error'

export default function VerifyEmailPage() {
  const [state, setState] = useState<State>('checking')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token') || ''
    if (!token) {
      setError('Ссылка недействительна — в ней нет токена.')
      setState('error')
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/verify-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        })
        if (cancelled) return
        if (res.ok) {
          setState('ok')
          return
        }
        const data = await res.json().catch(() => ({}))
        setError(data?.error || 'Не удалось подтвердить email.')
        setState('error')
      } catch {
        if (!cancelled) {
          setError('Сетевая ошибка. Попробуйте открыть ссылку ещё раз.')
          setState('error')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="c-card" style={{ maxWidth: 420, margin: '64px auto', padding: '32px 28px' }}>
      <h1 style={{ marginBottom: 24, fontSize: 28, color: 'var(--brand-text)' }}>Подтверждение email</h1>

      {state === 'checking' && <p style={{ fontSize: 15 }}>Подтверждаем адрес…</p>}

      {state === 'ok' && (
        <>
          <p style={{ fontSize: 15, lineHeight: 1.6 }}>
            Готово — ваш email подтверждён. Спасибо!
          </p>
          <Link href="/" className="c-btn c-btn--primary c-btn--block c-spotlight c-spotlight-bright" style={{ marginTop: 8 }}>
            На главную
          </Link>
        </>
      )}

      {state === 'error' && (
        <>
          <p className="c-field__error" style={{ marginTop: 8 }}>{error}</p>
          <p style={{ marginTop: 16, fontSize: 14 }}>
            <Link href="/">Вернуться на главную</Link>
          </p>
        </>
      )}
    </div>
  )
}
