'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

/**
 * Отписка от дайджеста (/unsubscribe?token=…).
 *
 * Токен читаем из query. Отписываем ТОЛЬКО по явному клику по кнопке — без
 * авто-POST, чтобы префетч ссылки почтовым клиентом не отписал человека сам.
 */
type State = 'idle' | 'sending' | 'done' | 'error'

export default function UnsubscribePage() {
  const [token, setToken] = useState('')
  const [state, setState] = useState<State>('idle')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get('token') || '')
  }, [])

  async function handleUnsub() {
    setError(null)
    if (!token) {
      setError('Ссылка недействительна — в ней нет токена.')
      setState('error')
      return
    }
    setState('sending')
    try {
      const res = await fetch('/api/notifications/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      if (res.ok) {
        setState('done')
        return
      }
      const data = await res.json().catch(() => ({}))
      setError(data?.error || 'Не удалось отписаться.')
      setState('error')
    } catch {
      setError('Сетевая ошибка. Попробуйте ещё раз.')
      setState('error')
    }
  }

  return (
    <div className="c-card" style={{ maxWidth: 420, margin: '64px auto', padding: '32px 28px' }}>
      <h1 style={{ marginBottom: 24, fontSize: 28, color: 'var(--brand-text)' }}>Отписка от дайджеста</h1>

      {state === 'done' ? (
        <>
          <p style={{ fontSize: 15, lineHeight: 1.6 }}>
            Готово — вы больше не будете получать дайджест новых материалов.
          </p>
          <p style={{ marginTop: 16, fontSize: 14 }}>
            <Link href="/">На главную</Link>
          </p>
        </>
      ) : (
        <>
          <p style={{ fontSize: 15, lineHeight: 1.6, marginBottom: 16 }}>
            Отписаться от писем с новыми материалами? Это не удаляет ваш аккаунт —
            вход и подписка останутся.
          </p>
          {state === 'error' && <p className="c-field__error" style={{ marginTop: 8 }}>{error}</p>}
          <button
            onClick={handleUnsub}
            disabled={state === 'sending'}
            className="c-btn c-btn--primary c-btn--block c-spotlight c-spotlight-bright" style={{ marginTop: 8 }}
          >
            {state === 'sending' ? 'Отписываем…' : 'Отписаться'}
          </button>
          <p style={{ marginTop: 16, fontSize: 14 }}>
            <Link href="/">Остаться подписанным</Link>
          </p>
        </>
      )}
    </div>
  )
}
