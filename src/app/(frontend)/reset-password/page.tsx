'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

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
    <div className="c-card" style={{ maxWidth: 420, margin: '64px auto', padding: '32px 28px' }}>
      <h1 style={{ marginBottom: 24, fontSize: 28, color: 'var(--brand-text)' }}>Новый пароль</h1>

      <label style={{ display: 'block', marginBottom: 16, fontSize: 14, fontWeight: 500 }}>
        Новый пароль
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="c-input" style={{ marginTop: 6 }}
          autoComplete="new-password"
          required
        />
      </label>

      {error && <p className="c-field__error" style={{ marginTop: 8 }}>{error}</p>}

      <button onClick={handleSubmit} disabled={loading} className="c-btn c-btn--primary c-btn--block c-spotlight c-spotlight-bright" style={{ marginTop: 8 }}>
        {loading ? 'Сохраняем…' : 'Сохранить пароль'}
      </button>

      <p style={{ marginTop: 16, fontSize: 14 }}>
        <Link href="/forgot-password">Запросить ссылку заново</Link>
      </p>
    </div>
  )
}
