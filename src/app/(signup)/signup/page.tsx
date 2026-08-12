'use client'
import './signup.css'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatPhoneInput } from '@/lib/phone'

/**
 * Регистрация автора (/signup) по НОМЕРУ ТЕЛЕФОНА (основной ID). Два шага:
 *   1) имя + телефон → отправляем SMS-код (/studio/api/auth/phone/request, register);
 *   2) код → создаём проект+автора (/api/register-author-phone), автологин куки → /studio.
 * Email автор укажет позже в профиле (для уведомлений). Пароль не нужен — вход по SMS.
 */
export default function SignupPage() {
  const router = useRouter()
  const [step, setStep] = useState<'form' | 'code'>('form')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function sendCode(e?: React.FormEvent) {
    if (e) e.preventDefault()
    setError(null)
    if (!phone.trim()) { setError('Укажите номер телефона.'); return }
    setLoading(true)
    try {
      const res = await fetch('/studio/api/auth/phone/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ phone, mode: 'register' }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.error || 'Не удалось отправить код.'); setLoading(false); return }
      setStep('code')
      setLoading(false)
    } catch {
      setError('Сетевая ошибка. Попробуйте ещё раз.')
      setLoading(false)
    }
  }

  async function createProject(e?: React.FormEvent) {
    if (e) e.preventDefault()
    setError(null)
    if (code.replace(/\D/g, '').length < 4) { setError('Введите код из SMS.'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/register-author-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name, phone, code }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.error || 'Не удалось создать проект.'); setLoading(false); return }
      // Сессия уже выставлена сервером — идём в студию (онбординг).
      router.replace('/studio')
      router.refresh()
    } catch {
      setError('Сетевая ошибка. Попробуйте ещё раз.')
      setLoading(false)
    }
  }

  function onKeyDown(e: React.KeyboardEvent, fn: () => void) {
    if (e.key === 'Enter') fn()
  }

  return (
    <div className="studio-login">
      <div className="studio-login__bg" aria-hidden>
        <span className="studio-login__grid" />
      </div>

      <div className="studio-login__card">
        <div className="studio-login__head">
          <h1>Создать проект</h1>
          <p>Контент Бокс · регистрация автора</p>
        </div>

        {step === 'form' ? (
          <form className="studio-login__form" onSubmit={sendCode}>
            <label className="studio-field">
              <span className="studio-field__label">Имя</span>
              <input
                className="studio-input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Как к вам обращаться"
                autoComplete="name"
                disabled={loading}
                autoFocus
              />
            </label>

            <label className="studio-field">
              <span className="studio-field__label">Телефон</span>
              <input
                className="studio-input"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
                onKeyDown={(e) => onKeyDown(e, sendCode)}
                placeholder="+7 900 000 00 00"
                disabled={loading}
                required
              />
            </label>

            {error && <div className="studio-login__error">{error}</div>}

            <button className="studio-btn studio-btn--primary studio-login__submit" type="submit" disabled={loading}>
              {loading ? 'Отправляем…' : 'Получить код'}
            </button>

            <p className="su-note">Подтвердим номер по SMS. Email добавите позже в профиле — для уведомлений.</p>
          </form>
        ) : (
          <form className="studio-login__form" onSubmit={createProject}>
            <label className="studio-field">
              <span className="studio-field__label">Код из SMS</span>
              <input
                className="studio-input"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={(e) => onKeyDown(e, createProject)}
                placeholder="______"
                maxLength={6}
                disabled={loading}
                autoFocus
              />
            </label>

            {error && <div className="studio-login__error">{error}</div>}

            <button className="studio-btn studio-btn--primary studio-login__submit" type="submit" disabled={loading}>
              {loading ? 'Создаём…' : 'Создать проект'}
            </button>

            <p style={{ marginTop: 12, fontSize: 13, textAlign: 'center' }}>
              <button type="button" className="studio-linklike" onClick={() => { setStep('form'); setError(null) }} disabled={loading}>
                Изменить номер
              </button>
            </p>
          </form>
        )}

        <div className="su-alt">
          Уже есть аккаунт? <a href="/studio/login">Войти</a>
        </div>
      </div>
    </div>
  )
}
