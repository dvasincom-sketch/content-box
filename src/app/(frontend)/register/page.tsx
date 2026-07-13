'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

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
    <div style={{ maxWidth: 400, margin: '64px auto', padding: '0 16px' }}>
      <h1 style={{ marginBottom: 24 }}>Регистрация</h1>

      <label style={labelStyle}>
        Имя
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          style={inputStyle}
          autoComplete="name"
        />
      </label>

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
          autoComplete="new-password"
          required
        />
      </label>

      {error && <p style={{ color: '#c00', fontSize: 14, marginTop: 8 }}>{error}</p>}

      <button onClick={handleSubmit} disabled={loading} style={buttonStyle}>
        {loading ? 'Регистрируем…' : 'Зарегистрироваться'}
      </button>

      <p style={{ marginTop: 16, fontSize: 14 }}>
        Уже есть аккаунт? <Link href="/login">Войти</Link>
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
