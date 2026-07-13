'use client'

import React, { useState } from 'react'
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
    <div style={{ maxWidth: 400, margin: '64px auto', padding: '0 16px' }}>
      <h1 style={{ marginBottom: 24 }}>Вход</h1>

      <label style={labelStyle}>
        Email
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={inputStyle}
          autoComplete="email"
          required
        />
      </label>

      <label style={labelStyle}>
        Пароль
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={inputStyle}
          autoComplete="current-password"
          required
        />
      </label>

      {error && <p style={{ color: '#c00', fontSize: 14, marginTop: 8 }}>{error}</p>}

      <button onClick={handleSubmit} disabled={loading} style={buttonStyle}>
        {loading ? 'Входим…' : 'Войти'}
      </button>

      <p style={{ marginTop: 16, fontSize: 14 }}>
        Нет аккаунта? <Link href="/register">Зарегистрироваться</Link>
      </p>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: 16,
  fontSize: 14,
  fontWeight: 500,
}
const inputStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  marginTop: 6,
  padding: '10px 12px',
  fontSize: 15,
  border: '1px solid #ccc',
  borderRadius: 8,
  boxSizing: 'border-box',
}
const buttonStyle: React.CSSProperties = {
  width: '100%',
  marginTop: 8,
  padding: '12px',
  fontSize: 15,
  fontWeight: 600,
  color: '#fff',
  background: '#111',
  border: 'none',
  borderRadius: 8,
  cursor: 'pointer',
}
