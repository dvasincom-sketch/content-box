'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
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
    <div style={authCardStyle}>
      <h1 style={authHeadingStyle}>Вход</h1>

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

      <label style={authLabelStyle}>
        Пароль
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={authInputStyle}
          autoComplete="current-password"
          required
        />
      </label>

      {error && <p style={authErrorStyle}>{error}</p>}

      <button onClick={handleSubmit} disabled={loading} style={authButtonStyle}>
        {loading ? 'Входим…' : 'Войти'}
      </button>

      <p style={authAltLinkStyle}>
        Нет аккаунта? <Link href="/register">Зарегистрироваться</Link>
      </p>
    </div>
  )
}
