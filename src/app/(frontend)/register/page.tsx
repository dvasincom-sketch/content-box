'use client'

import { useState, useEffect, useRef, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { formatPhoneInput } from '@/lib/phone'

/**
 * Регистрация подписчика (/register). Два способа:
 *  • «По телефону» — авторизация ЗВОНКОМ ОТ КЛИЕНТА (без пароля): выдаём номер,
 *    пользователь звонит сам, система узнаёт его по АОН. Если номер уже
 *    зарегистрирован — просто входим (помним ранее авторизовавшихся).
 *  • «По email» — /api/register-subscriber + автологин.
 */
type Mode = 'phone' | 'email'
type PhoneStep = 'phone' | 'await'

export default function RegisterPage() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('phone')

  // email
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')

  // phone
  const [phone, setPhone] = useState('')
  const [callPhone, setCallPhone] = useState('')
  const [callPhonePretty, setCallPhonePretty] = useState('')
  const [step, setStep] = useState<PhoneStep>('phone')

  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const stopPoll = () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null } }
  useEffect(() => () => stopPoll(), [])

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
      if (!res.ok) { setError(data?.error || 'Не удалось создать заявку.'); setLoading(false); return }
      if (data?.loggedIn) { done(); return }
      setCallPhone(data?.callPhone || '')
      setCallPhonePretty(data?.callPhonePretty || data?.callPhone || '')
      setStep('await'); setLoading(false)
      startPolling()
    } catch { setError('Сетевая ошибка. Попробуйте ещё раз.'); setLoading(false) }
  }

  function startPolling() {
    stopPoll()
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch('/api/auth/phone/callcheck', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
          body: JSON.stringify({ phone }),
        })
        const data = await res.json().catch(() => ({}))
        if (data?.loggedIn) { stopPoll(); done(); return }
        if (data?.expired || res.status === 410) {
          stopPoll(); setStep('phone'); setError('Время истекло. Получите номер и позвоните ещё раз.')
        }
      } catch { /* сеть моргнула — повторим на следующем тике */ }
    }, 3000)
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
              {loading ? 'Готовим номер…' : 'Войти по звонку'}
            </button>
            <p style={{ marginTop: 12, fontSize: 13, color: 'var(--brand-muted)' }}>
              Мы покажем номер — позвоните на него <b>с этого телефона</b>. Отвечать/дозваниваться не нужно, звонок бесплатный, система узнает вас по номеру. Если аккаунт уже есть, просто войдёте.
            </p>
          </form>
        ) : (
          <div>
            <p style={{ margin: '0 0 8px', fontSize: 14 }}>Позвоните с номера <b>{phone}</b> на:</p>
            <a href={`tel:${callPhone}`} className="c-btn c-btn--primary c-btn--block" style={{ fontSize: 20, letterSpacing: '.5px', textDecoration: 'none', textAlign: 'center' }}>
              {callPhonePretty || callPhone}
            </a>
            <p style={{ marginTop: 12, fontSize: 13, color: 'var(--brand-muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span aria-hidden style={{ width: 14, height: 14, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin .8s linear infinite' }} />
              Ждём ваш звонок… Как только наберёте — войдём автоматически.
            </p>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            {error && <p className="c-field__error" style={{ marginTop: 4, marginBottom: 8 }}>{error}</p>}
            <button type="button" className="c-btn c-btn--block" style={{ marginTop: 8, background: 'transparent' }} onClick={() => { stopPoll(); setStep('phone'); setError(null) }}>
              ← Изменить номер
            </button>
          </div>
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
