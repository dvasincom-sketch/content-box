'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'

export function LoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit() {
    setError(null)
    if (!email || !password) {
      setError('Введите почту и пароль')
      return
    }
    setLoading(true)
    try {
      // Payload-auth коллекции users. Кука httpOnly ставится сервером —
      // сессия общая с админкой.
      const res = await fetch('/api/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      })

      if (!res.ok) {
        // Payload отдаёт 401 с { errors: [{ message }] }
        setError('Неверная почта или пароль')
        setLoading(false)
        return
      }

      // Успех: guard в layout сам разрулит доступ. Идём на дашборд.
      router.replace('/studio')
      router.refresh()
    } catch {
      setError('Не удалось войти. Проверьте соединение.')
      setLoading(false)
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleSubmit()
  }

  return (
    <div className="studio-login__form">
      <label className="studio-field">
        <span className="studio-field__label">Почта</span>
        <input
          className="studio-input"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="you@example.com"
          disabled={loading}
        />
      </label>

      <label className="studio-field">
        <span className="studio-field__label">Пароль</span>
        <input
          className="studio-input"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={onKeyDown}
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
        {loading ? 'Вход…' : 'Войти'}
      </button>
    </div>
  )
}
