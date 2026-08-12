'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export function LoginForm() {
  const router = useRouter()
  const [mode, setMode] = useState<'password' | 'phone'>('password')

  // password mode
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  // phone mode
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [phoneStep, setPhoneStep] = useState<'phone' | 'code'>('phone')

  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  function goStudio() {
    router.replace('/studio')
    router.refresh()
  }

  async function handlePassword() {
    setError(null)
    if (!email || !password) { setError('Введите почту и пароль'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      })
      if (!res.ok) { setError('Неверная почта или пароль'); setLoading(false); return }
      goStudio()
    } catch {
      setError('Не удалось войти. Проверьте соединение.'); setLoading(false)
    }
  }

  async function sendCode() {
    setError(null)
    if (!phone.trim()) { setError('Введите номер телефона'); return }
    setLoading(true)
    try {
      const res = await fetch('/studio/api/auth/phone/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ phone, mode: 'login' }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) { setError(json?.error || 'Не удалось отправить код'); setLoading(false); return }
      setPhoneStep('code')
      setLoading(false)
    } catch {
      setError('Не удалось отправить код. Проверьте соединение.'); setLoading(false)
    }
  }

  async function verifyCode() {
    setError(null)
    if (code.replace(/\D/g, '').length < 4) { setError('Введите код из SMS'); return }
    setLoading(true)
    try {
      const res = await fetch('/studio/api/auth/phone/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ phone, code }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) { setError(json?.error || 'Неверный код'); setLoading(false); return }
      goStudio()
    } catch {
      setError('Не удалось войти. Проверьте соединение.'); setLoading(false)
    }
  }

  function switchMode(next: 'password' | 'phone') {
    setMode(next); setError(null); setPhoneStep('phone'); setCode('')
  }

  function onKeyDown(e: React.KeyboardEvent, fn: () => void) {
    if (e.key === 'Enter') fn()
  }

  if (mode === 'phone') {
    return (
      <div className="studio-login__form">
        {phoneStep === 'phone' ? (
          <>
            <label className="studio-field">
              <span className="studio-field__label">Телефон</span>
              <input
                className="studio-input"
                type="tel"
                autoComplete="tel"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onKeyDown={(e) => onKeyDown(e, sendCode)}
                placeholder="+7 900 000-00-00"
                disabled={loading}
              />
            </label>
            {error && <div className="studio-login__error">{error}</div>}
            <button className="studio-btn studio-btn--primary studio-login__submit" onClick={sendCode} disabled={loading}>
              {loading ? 'Отправляем…' : 'Получить код'}
            </button>
          </>
        ) : (
          <>
            <label className="studio-field">
              <span className="studio-field__label">Код из SMS</span>
              <input
                className="studio-input"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={(e) => onKeyDown(e, verifyCode)}
                placeholder="______"
                maxLength={6}
                disabled={loading}
                autoFocus
              />
            </label>
            {error && <div className="studio-login__error">{error}</div>}
            <button className="studio-btn studio-btn--primary studio-login__submit" onClick={verifyCode} disabled={loading}>
              {loading ? 'Вход…' : 'Войти'}
            </button>
            <p style={{ marginTop: 12, fontSize: 13, textAlign: 'center' }}>
              <button type="button" className="studio-linklike" onClick={() => { setPhoneStep('phone'); setError(null) }} disabled={loading}>
                Изменить номер
              </button>
            </p>
          </>
        )}

        <p style={{ marginTop: 12, fontSize: 13, textAlign: 'center' }}>
          <button type="button" className="studio-linklike" onClick={() => switchMode('password')} disabled={loading}>
            Войти по паролю
          </button>
        </p>
      </div>
    )
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
          onKeyDown={(e) => onKeyDown(e, handlePassword)}
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
          onKeyDown={(e) => onKeyDown(e, handlePassword)}
          placeholder="••••••••"
          disabled={loading}
        />
      </label>

      {error && <div className="studio-login__error">{error}</div>}

      <button
        className="studio-btn studio-btn--primary studio-login__submit"
        onClick={handlePassword}
        disabled={loading}
      >
        {loading ? 'Вход…' : 'Войти'}
      </button>

      <p style={{ marginTop: 12, fontSize: 13, textAlign: 'center', display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
        <Link href="/studio/forgot-password">Забыли пароль?</Link>
        <button type="button" className="studio-linklike" onClick={() => switchMode('phone')} disabled={loading}>
          Войти по номеру телефона
        </button>
      </p>
    </div>
  )
}
