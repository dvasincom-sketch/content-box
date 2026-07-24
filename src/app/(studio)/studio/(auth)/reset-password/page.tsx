'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

/**
 * Установка нового пароля автором по ссылке из письма. Токен из ?token=.
 * Эндпоинт /api/users/reset-password ставит cookie (логинит) → на дашборд.
 */
export default function StudioResetPasswordPage() {
  const router = useRouter()
  const [token, setToken] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get('token') || '')
  }, [])

  async function handleSubmit() {
    setError(null)
    if (password.length < 8) {
      setError('Пароль должен быть не короче 8 символов.')
      return
    }
    if (!token) {
      setError('Ссылка недействительна. Запросите сброс заново.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/users/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ token, password }),
      })
      if (!res.ok) {
        setError('Не удалось сбросить пароль. Ссылка могла устареть — запросите новую.')
        setLoading(false)
        return
      }
      router.replace('/studio')
      router.refresh()
    } catch {
      setError('Не удалось сохранить. Проверьте соединение.')
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
          <h1>Новый пароль</h1>
          <p>Контент Бокс</p>
        </div>

        <div className="studio-login__form">
          <label className="studio-field">
            <span className="studio-field__label">Новый пароль</span>
            <input
              className="studio-input"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              placeholder="••••••••"
              disabled={loading}
            />
          </label>

          {error && <div className="studio-login__error">{error}</div>}

          <button
            className="studio-btn studio-btn--primary studio-login__submit"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? 'Сохраняем…' : 'Сохранить пароль'}
          </button>

          <p style={{ marginTop: 16, fontSize: 14, textAlign: 'center' }}>
            <Link href="/studio/forgot-password">Запросить ссылку заново</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
