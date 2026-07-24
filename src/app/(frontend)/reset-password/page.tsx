'use client'

import { useEffect, useState } from 'react'
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
 * Установка нового пароля подписчиком по ссылке из письма.
 * Токен читаем из ?token=. Бьём в /api/subscribers/reset-password — Payload
 * сбрасывает пароль и ставит cookie (логинит). После успеха — на главную.
 */
export default function ResetPasswordPage() {
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
      const res = await fetch('/api/subscribers/reset-password', {
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
      router.push('/')
      router.refresh()
    } catch {
      setError('Сетевая ошибка. Попробуйте ещё раз.')
      setLoading(false)
    }
  }

  return (
    <div style={authCardStyle}>
      <h1 style={authHeadingStyle}>Новый пароль</h1>

      <label style={authLabelStyle}>
        Новый пароль
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
        {loading ? 'Сохраняем…' : 'Сохранить пароль'}
      </button>

      <p style={authAltLinkStyle}>
        <Link href="/forgot-password">Запросить ссылку заново</Link>
      </p>
    </div>
  )
}
