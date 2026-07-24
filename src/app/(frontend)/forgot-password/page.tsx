'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  authCardStyle,
  authHeadingStyle,
  authLabelStyle,
  authInputStyle,
  authButtonStyle,
  authErrorStyle,
  authAltLinkStyle,
} from '../authFormStyles'

/**
 * Запрос сброса пароля подписчиком. Бьёт в дефолтный Payload-эндпоинт
 * /api/subscribers/forgot-password — он находит подписчика по email и шлёт
 * письмо с ссылкой (в бренде тенанта). Ответ всегда 200 (не раскрываем наличие).
 */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit() {
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/subscribers/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      })
      if (!res.ok) {
        setError('Не удалось отправить письмо. Попробуйте ещё раз.')
        setLoading(false)
        return
      }
      setSent(true)
    } catch {
      setError('Сетевая ошибка. Попробуйте ещё раз.')
      setLoading(false)
    }
  }

  return (
    <div style={authCardStyle}>
      <h1 style={authHeadingStyle}>Сброс пароля</h1>

      {sent ? (
        <p style={{ fontSize: 15, lineHeight: 1.6 }}>
          Если аккаунт с таким email существует, мы отправили письмо со ссылкой для сброса
          пароля. Проверьте почту (и папку «Спам»).
        </p>
      ) : (
        <>
          <label style={authLabelStyle}>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={authInputStyle}
              autoComplete="email"
              required
            />
          </label>

          {error && <p style={authErrorStyle}>{error}</p>}

          <button onClick={handleSubmit} disabled={loading} style={authButtonStyle}>
            {loading ? 'Отправляем…' : 'Отправить ссылку'}
          </button>
        </>
      )}

      <p style={authAltLinkStyle}>
        <Link href="/login">Вернуться ко входу</Link>
      </p>
    </div>
  )
}
