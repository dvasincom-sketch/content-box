'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { formatPhoneInput } from '@/lib/phone'

/**
 * Регистрация подписчика (/register). Два способа:
 *  • «По телефону» — подтверждение по ЗВОНКУ (без пароля). Тот же поток, что и
 *    вход: /api/auth/phone/request → verify. Если номер уже зарегистрирован —
 *    просто входим (система помнит ранее авторизовавшихся).
 *  • «По email» — /api/register-subscriber + автологин.
 */
type Mode = 'phone' | 'email'
type PhoneStep = 'phone' | 'code'

export default function RegisterPage() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('phone')

  // email
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')

  // phone
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<PhoneStep>('phone')

  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  function done() {
    router.push('/')
    router.refresh()
  }

  async function handleEmail() {
    setError(null)
    if (password.length < 8) { setError('Пароль должен быть не короче 8 символов.'); return }
    setLoading(true)
    try {
      const regRes = await fetch('/api/register-subscriber', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, displayName }),
      })
      const regData = await regRes.json().catch(() => ({}))
      if (!regRes.ok) { setError(regData.error || 'Не удалось зарегистрироваться.'); setLoading(false); return }
      const loginRes = await fetch('/api/subscribers/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      if (!loginRes.ok) { router.push('/login'); return }
      done()
    } catch { setError('Сетевая ошибка. Попробуйте ещё раз.'); setLoading(false) }
  }

  async function requestCall(e: FormEvent) {
    e.preventDefault()
    setError(null); setLoading(true)
    try {
      const res = await fetch('/api/auth/phone/request', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data?.error || 'Не удалось заказать звонок.'); setLoading(false); return }
      if (data?.loggedIn) { done(); return }
      setStep('code'); setLoading(false)
    } catch { setError('Сетевая ошибка. Попробуйте ещё раз.'); setLoading(false) }
  }

  async function submitCode(e: FormEvent) {
    e.preventDefault()
    setError(null); setLoading(true)
    try {
      const res = await fetch('/api/auth/phone/verify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code, remember: true }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data?.error || 'Неверный код.'); setLoading(false); return }
      done()
    } catch { setError('Сетевая ошибка. Попробуйте ещё раз.'); setLoading(false) }
  }

  const tabBtn = (m: Mode, label: string) => (
    <button
      type="button"
      onClick={() => { setMode(m); setError(null) }}
      className="c-btn"
      style={{
        flex: 1,
        background: mode === m ? 'var(--brand-primary, #ea580c)' : 'transparent',
        color: mode === m ? '#fff' : 'var(--brand-text)',
        border: `1px solid ${mode === m ? 'var(--brand-primary, #ea580c)' : 'var(--brand-border, rgba(0,0,0,.14))'}`,
      }}
    >
      {label}
    </button>
  )

  return (
    <div className="c-card" style={{ maxWidth: 420, margin: '64px auto', padding: '32px 28px' }}>
      <h1 style={{ marginBottom: 20, fontSize: 28, color: 'var(--brand-text)' }}>Регистрация</h1>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {tabBtn('phone', 'По телефону')}
        {tabBtn('email', 'По email')}
      </div>

      {mode === 'phone' ? (
        step === 'phone' ? (
          <form onSubmit={requestCall}>
            <label style={{ display: 'block', marginBottom: 12, fontSize: 14, fontWeight: 500 }}>
              Телефон
              <input
                type="tel" inputMode="tel" value={phone}
                onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
                className="c-input" style={{ marginTop: 6 }} autoComplete="tel"
                placeholder="+7 900 000 00 00" required
              />
            </label>
            {error && <p className="c-field__error" style={{ marginTop: 4, marginBottom: 8 }}>{error}</p>}
            <button type="submit" disabled={loading} className="c-btn c-btn--primary c-btn--block" style={{ marginTop: 4 }}>
              {loading ? 'Заказываем звонок…' : 'Получить звонок'}
            </button>
            <p style={{ marginTop: 12, fontSize: 13, color: 'var(--brand-muted)' }}>
              Вам поступит звонок — отвечать не нужно. Код — <b>последние 4 цифры</b> номера, с которого позвонят. Если аккаунт уже есть, просто войдёте.
            </p>
          </form>
        ) : (
          <form onSubmit={submitCode}>
            <label style={{ display: 'block', marginBottom: 12, fontSize: 14, fontWeight: 500 }}>
              Последние 4 цифры номера звонка
              <input
                type="text" inputMode="numeric" autoComplete="one-time-code" value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
                className="c-input" style={{ marginTop: 6 }} placeholder="____" required autoFocus
              />
            </label>
            {error && <p className="c-field__error" style={{ marginTop: 4, marginBottom: 8 }}>{error}</p>}
            <button type="submit" disabled={loading} className="c-btn c-btn--primary c-btn--block">
              {loading ? 'Проверяем…' : 'Подтвердить'}
            </button>
            <button
              type="button" className="c-btn c-btn--block" style={{ marginTop: 8, background: 'transparent' }}
              onClick={() => { setStep('phone'); setCode(''); setError(null) }}
            >
              ← Изменить номер
            </button>
          </form>
        )
      ) : (
        <>
          <label style={{ display: 'block', marginBottom: 16, fontSize: 14, fontWeight: 500 }}>
            Имя
            <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="c-input" style={{ marginTop: 6 }} autoComplete="name" />
          </label>
          <label style={{ display: 'block', marginBottom: 16, fontSize: 14, fontWeight: 500 }}>
            Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="c-input" style={{ marginTop: 6 }} autoComplete="email" required />
          </label>
          <label style={{ display: 'block', marginBottom: 16, fontSize: 14, fontWeight: 500 }}>
            Пароль
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="c-input" style={{ marginTop: 6 }} autoComplete="new-password" required />
          </label>
          {error && <p className="c-field__error" style={{ marginTop: 8 }}>{error}</p>}
          <button onClick={handleEmail} disabled={loading} className="c-btn c-btn--primary c-btn--block c-spotlight c-spotlight-bright" style={{ marginTop: 8 }}>
            {loading ? 'Регистрируем…' : 'Зарегистрироваться'}
          </button>
        </>
      )}

      <p style={{ marginTop: 16, fontSize: 14 }}>
        Уже есть аккаунт? <Link href="/login">Войти</Link>
      </p>
    </div>
  )
}
