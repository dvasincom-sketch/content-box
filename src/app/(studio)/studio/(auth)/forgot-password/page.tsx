'use client'

import { useState } from 'react'
import Link from 'next/link'

/**
 * Запрос сброса пароля автором. Эндпоинт /api/users/forgot-password (бренд
 * платформы, ссылка ведёт на /studio/reset-password). Под (auth)-layout —
 * авторизованных отсюда уводит на дашборд.
 */
export default function StudioForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit() {
    setError(null)
    if (!email) {
      setError('Введите почту')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/users/forgot-password', {
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
      setError('Не удалось отправить. Проверьте соединение.')
      setLoading(false)
    }
  }

  return (
    <div className="studio-login">
      <div className="studio-login__bg" aria-hidden>
        <span className="studio-login__grid" />
      </div>

      <div className="studio-login__card">
        <div className="studio-login__head">
          <h1>Сброс пароля</h1>
          <p>Контент Бокс · восстановление доступа</p>
        </div>

        <div className="studio-login__form">
          {sent ? (
            <p style={{ fontSize: 14, lineHeight: 1.6 }}>
              Если аккаунт с такой почтой существует, мы отправили письмо со ссылкой для сброса
              пароля. Проверьте почту (и «Спам»).
            </p>
          ) : (
            <>
              <label className="studio-field">
                <span className="studio-field__label">Почта</span>
                <input
                  className="studio-input"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                  placeholder="you@example.com"
                  disabled={loading}
                />
              </label>

              {error && <div className="studio-login__error">{error}</div>}

              <button
                className="studio-btn studio-btn--primary studio-login__submit"
                onClick={handleSubmit}
                disabled={loading}
              >
                {loading ? 'Отправляем…' : 'Отправить ссылку'}
              </button>
            </>
          )}

          <p style={{ marginTop: 16, fontSize: 14, textAlign: 'center' }}>
            <Link href="/studio/login">Вернуться ко входу</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
