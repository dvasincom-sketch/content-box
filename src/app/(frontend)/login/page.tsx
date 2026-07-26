'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

/**
 * Страница входа подписчика (/login).
 *
 * Бьёт в дефолтный Payload-эндпоинт /api/subscribers/login — он проверяет
 * пароль и ставит httpOnly-cookie. Работает именно с коллекцией subscribers,
 * не с users (админами) — разные эндпоинты, разные cookie.
 */
export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit() {
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/subscribers/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      })
      if (!res.ok) {
        setError('Неверный email или пароль.')
        setLoading(false)
        return
      }
      router.push('/')
      router.refresh()
    } catch {
      setError('Сетевая ошибка. Попробуйте ещё раз.')
      setLoading(false)
    }
  }

  return (
    <div className="c-card" style={{ maxWidth: 420, margin: '64px auto', padding: '32px 28px' }}>
      <h1 style={{ marginBottom: 24, fontSize: 28, color: 'var(--brand-text)' }}>Вход</h1>

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

      <label style={{ display: 'block', marginBottom: 16, fontSize: 14, fontWeight: 500 }}>
        Пароль
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="c-input" style={{ marginTop: 6 }}
          autoComplete="current-password"
          required
        />
      </label>

      {error && <p className="c-field__error" style={{ marginTop: 8 }}>{error}</p>}

      <button onClick={handleSubmit} disabled={loading} className="c-btn c-btn--primary c-btn--block c-spotlight c-spotlight-bright" style={{ marginTop: 8 }}>
        {loading ? 'Входим…' : 'Войти'}
      </button>

      <p style={{ marginTop: 16, fontSize: 14 }}>
        <Link href="/forgot-password">Забыли пароль?</Link>
      </p>

      <p style={{ marginTop: 16, fontSize: 14 }}>
        Нет аккаунта? <Link href="/register">Зарегистрироваться</Link>
      </p>
    </div>
  )
}
