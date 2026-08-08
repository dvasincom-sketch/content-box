'use client'

import { useState, type FormEvent } from 'react'
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

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
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
    <div className="auth">
      <div className="auth__card">
        <div className="auth__head">
          <h1 className="auth__title">С возвращением</h1>
          <p className="auth__sub">Войдите, чтобы продолжить смотреть</p>
        </div>

        <form className="auth__form" onSubmit={handleSubmit}>
          <div className="auth__field">
            <label className="auth__label" htmlFor="auth-email">Email</label>
            <input
              id="auth-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="auth__input"
              autoComplete="email"
              placeholder="you@example.com"
              required
            />
          </div>

          <div className="auth__field">
            <label className="auth__label" htmlFor="auth-pass">Пароль</label>
            <input
              id="auth-pass"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="auth__input"
              autoComplete="current-password"
              placeholder="••••••••"
              required
            />
          </div>

          {error && <p className="auth__error">{error}</p>}

          <button type="submit" disabled={loading} className="auth__btn">
            {loading ? 'Входим…' : 'Войти'}
          </button>
        </form>

        <div className="auth__links">
          <Link href="/forgot-password" className="auth__link">Забыли пароль?</Link>
          <span className="auth__reg">
            Нет аккаунта? <Link href="/register" className="auth__link auth__link--accent">Зарегистрироваться</Link>
          </span>
        </div>
      </div>
    </div>
  )
}
