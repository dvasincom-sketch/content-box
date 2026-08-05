'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Форма установки пароля при приёме приглашения. Шлёт токен+пароль на
 * /studio/api/access/accept; после успеха уводит на вход (роут пароль ставит,
 * но не логинит).
 */
export function AcceptInviteForm({ token, email }: { token: string; email: string }) {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  async function submit() {
    setError(null)
    if (password.length < 8) { setError('Пароль должен быть не короче 8 символов.'); return }
    setLoading(true)
    try {
      const res = await fetch('/studio/api/access/accept', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ token, password }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) { setError(json.error || 'Не удалось сохранить пароль.'); setLoading(false); return }
      setDone(true)
      setTimeout(() => { router.replace('/studio/login'); router.refresh() }, 1200)
    } catch {
      setError('Не удалось сохранить. Проверьте соединение.'); setLoading(false)
    }
  }

  return (
    <div className="studio-login">
      <div className="studio-login__bg" aria-hidden><span className="studio-login__grid" /></div>
      <div className="studio-login__card">
        <div className="studio-login__head">
          <h1>Приглашение в студию</h1>
          <p>{email} — придумайте пароль для входа.</p>
        </div>
        {done ? (
          <div className="studio-login__form" style={{ color: 'var(--st-text-muted)' }}>Пароль сохранён. Открываем страницу входа…</div>
        ) : (
          <div className="studio-login__form">
            <label className="studio-field">
              <span className="studio-field__label">Пароль</span>
              <input
                className="studio-input"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
                placeholder="Не короче 8 символов"
                autoFocus
                disabled={loading}
              />
            </label>
            {error && <div className="studio-login__error">{error}</div>}
            <button
              type="button"
              className="studio-btn studio-btn--primary studio-login__submit"
              onClick={submit}
              disabled={loading}
            >
              {loading ? 'Сохраняем…' : 'Войти в студию'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
