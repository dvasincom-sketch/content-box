'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  authCardStyle,
  authHeadingStyle,
  authButtonStyle,
  authErrorStyle,
  authAltLinkStyle,
} from '../authFormStyles'

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
    <div style={authCardStyle}>
      <h1 style={authHeadingStyle}>Отписка от дайджеста</h1>

      {state === 'done' ? (
        <>
          <p style={{ fontSize: 15, lineHeight: 1.6 }}>
            Готово — вы больше не будете получать дайджест новых материалов.
          </p>
          <p style={authAltLinkStyle}>
            <Link href="/">На главную</Link>
          </p>
        </>
      ) : (
        <>
          <p style={{ fontSize: 15, lineHeight: 1.6, marginBottom: 16 }}>
            Отписаться от писем с новыми материалами? Это не удаляет ваш аккаунт —
            вход и подписка останутся.
          </p>
          {state === 'error' && <p style={authErrorStyle}>{error}</p>}
          <button
            onClick={handleUnsub}
            disabled={state === 'sending'}
            style={authButtonStyle}
          >
            {state === 'sending' ? 'Отписываем…' : 'Отписаться'}
          </button>
          <p style={authAltLinkStyle}>
            <Link href="/">Остаться подписанным</Link>
          </p>
        </>
      )}
    </div>
  )
}
