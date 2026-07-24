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
 * Страница регистрации подписчика (/register).
 *
 * Шлёт данные на кастомный серверный роут /api/register-subscriber, который
 * сам проставляет tenant по домену. После успеха — сразу логинит через
 * дефолтный Payload-эндпоинт /api/subscribers/login (ставит httpOnly-cookie).
 */
export default function RegisterPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit() {
    setError(null)
    if (password.length < 8) {
      setError('Пароль должен быть не короче 8 символов.')
      return
    }
    setLoading(true)
    try {
      // 1. Регистрация (tenant проставит сервер).
      const regRes = await fetch('/api/register-subscriber', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, displayName }),
      })
      const regData = await regRes.json()
      if (!regRes.ok) {
        setError(regData.error || 'Не удалось зарегистрироваться.')
        setLoading(false)
        return
      }

      // 2. Автологин (Payload поставит cookie).
      const loginRes = await fetch('/api/subscribers/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      if (!loginRes.ok) {
        // Регистрация прошла, но автологин нет — отправим на страницу входа.
        router.push('/login')
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
      <h1 style={authHeadingStyle}>Регистрация</h1>

      <label style={authLabelStyle}>
        Имя
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          style={authInputStyle}
          autoComplete="name"
        />
      </label>

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
          autoComplete="new-password"
          required
        />
      </label>

      {error && <p style={authErrorStyle}>{error}</p>}

      <button onClick={handleSubmit} disabled={loading} style={authButtonStyle}>
        {loading ? 'Регистрируем…' : 'Зарегистрироваться'}
      </button>

      <p style={authAltLinkStyle}>
        Уже есть аккаунт? <Link href="/login">Войти</Link>
      </p>
    </div>
  )
}
