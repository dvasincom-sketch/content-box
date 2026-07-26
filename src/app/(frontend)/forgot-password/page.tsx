'use client'

import { useState } from 'react'
import Link from 'next/link'

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
    <div className="c-card" style={{ maxWidth: 420, margin: '64px auto', padding: '32px 28px' }}>
      <h1 style={{ marginBottom: 24, fontSize: 28, color: 'var(--brand-text)' }}>Сброс пароля</h1>

      {sent ? (
        <p style={{ fontSize: 15, lineHeight: 1.6 }}>
          Если аккаунт с таким email существует, мы отправили письмо со ссылкой для сброса
          пароля. Проверьте почту (и папку «Спам»).
        </p>
      ) : (
        <>
          <label style={{ display: 'block', marginBottom: 16, fontSize: 14, fontWeight: 500 }}>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="c-input" style={{ marginTop: 6 }}
              autoComplete="email"
              required
            />
          </label>

          {error && <p className="c-field__error" style={{ marginTop: 8 }}>{error}</p>}

          <button onClick={handleSubmit} disabled={loading} className="c-btn c-btn--primary c-btn--block c-spotlight c-spotlight-bright" style={{ marginTop: 8 }}>
            {loading ? 'Отправляем…' : 'Отправить ссылку'}
          </button>
        </>
      )}

      <p style={{ marginTop: 16, fontSize: 14 }}>
        <Link href="/login">Вернуться ко входу</Link>
      </p>
    </div>
  )
}
