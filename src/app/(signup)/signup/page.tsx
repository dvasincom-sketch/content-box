'use client'
import './signup.css'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatPhoneInput } from '@/lib/phone'

/**
 * Регистрация автора (/signup) по НОМЕРУ ТЕЛЕФОНА (основной ID).
 *   1) имя (обяз.) + телефон + e-mail (опц.) → SMS-код;
 *   2) код → создаём проект+автора (/api/register-author-phone). Если e-mail
 *      занят — сервер вернёт needsLink, и мы переходим к шагу 3;
 *   3) код с почты → привязываем телефон к существующему аккаунту (link-email).
 */
export default function SignupPage() {
  const router = useRouter()
  const [step, setStep] = useState<'form' | 'code' | 'link'>('form')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [linkCode, setLinkCode] = useState('')
  const [ticket, setTicket] = useState('')
  const [linkEmail, setLinkEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function sendCode(e?: React.FormEvent) {
    if (e) e.preventDefault()
    setError(null)
    if (!name.trim()) { setError('Укажите имя.'); return }
    if (!phone.trim()) { setError('Укажите номер телефона.'); return }
    setLoading(true)
    try {
      const res = await fetch('/studio/api/auth/phone/request', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ phone, mode: 'register' }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.error || 'Не удалось отправить код.'); setLoading(false); return }
      setStep('code'); setLoading(false)
    } catch { setError('Сетевая ошибка. Попробуйте ещё раз.'); setLoading(false) }
  }

  async function createProject(e?: React.FormEvent) {
    if (e) e.preventDefault()
    setError(null)
    if (code.replace(/\D/g, '').length < 4) { setError('Введите код из SMS.'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/register-author-phone', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ name, phone, code, email: email.trim() || undefined }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.error || 'Не удалось создать проект.'); setLoading(false); return }
      if (data.needsLink) {
        setTicket(data.ticket || ''); setLinkEmail(data.email || email.trim()); setStep('link'); setLoading(false)
        return
      }
      router.replace('/studio'); router.refresh()
    } catch { setError('Сетевая ошибка. Попробуйте ещё раз.'); setLoading(false) }
  }

  async function confirmLink(e?: React.FormEvent) {
    if (e) e.preventDefault()
    setError(null)
    if (linkCode.replace(/\D/g, '').length < 4) { setError('Введите код с почты.'); return }
    setLoading(true)
    try {
      const res = await fetch('/studio/api/auth/phone/link-email', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ ticket, code: linkCode }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.error || 'Не удалось привязать номер.'); setLoading(false); return }
      router.replace('/studio'); router.refresh()
    } catch { setError('Сетевая ошибка. Попробуйте ещё раз.'); setLoading(false) }
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

        {step === 'form' && (
          <form className="studio-login__form" onSubmit={sendCode}>
            <label className="studio-field">
              <span className="studio-field__label">Имя</span>
              <input className="studio-input" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Как к вам обращаться" autoComplete="name" disabled={loading} autoFocus />
            </label>
            <label className="studio-field">
              <span className="studio-field__label">Телефон</span>
              <input className="studio-input" type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(formatPhoneInput(e.target.value))} onKeyDown={(e) => onKeyDown(e, sendCode)} placeholder="+7 900 000 00 00" disabled={loading} required />
            </label>
            <label className="studio-field">
              <span className="studio-field__label">E-mail <span style={{ opacity: 0.6, fontWeight: 400 }}>· можно пропустить</span></span>
              <input className="studio-input" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" disabled={loading} />
            </label>

            {error && <div className="studio-login__error">{error}</div>}
            <button className="studio-btn studio-btn--primary studio-login__submit" type="submit" disabled={loading}>
              {loading ? 'Отправляем…' : 'Получить код'}
            </button>
            <p className="su-note">Подтвердим номер по SMS. E-mail — для уведомлений и восстановления доступа; можно добавить позже в профиле.</p>
          </form>
        )}

        {step === 'code' && (
          <form className="studio-login__form" onSubmit={createProject}>
            <label className="studio-field">
              <span className="studio-field__label">Код из SMS</span>
              <input className="studio-input" type="text" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => onKeyDown(e, createProject)} placeholder="______" maxLength={6} disabled={loading} autoFocus />
            </label>
            {error && <div className="studio-login__error">{error}</div>}
            <button className="studio-btn studio-btn--primary studio-login__submit" type="submit" disabled={loading}>
              {loading ? 'Создаём…' : 'Создать проект'}
            </button>
            <p style={{ marginTop: 12, fontSize: 13, textAlign: 'center' }}>
              <button type="button" className="studio-linklike" onClick={() => { setStep('form'); setError(null) }} disabled={loading}>Изменить данные</button>
            </p>
          </form>
        )}

        {step === 'link' && (
          <form className="studio-login__form" onSubmit={confirmLink}>
            <p className="su-note" style={{ marginTop: 0 }}>
              E-mail <b>{linkEmail}</b> уже зарегистрирован. Мы отправили на него код — введите его, чтобы привязать этот номер к существующему аккаунту.
            </p>
            <label className="studio-field">
              <span className="studio-field__label">Код с почты</span>
              <input className="studio-input" type="text" inputMode="numeric" autoComplete="one-time-code" value={linkCode} onChange={(e) => setLinkCode(e.target.value)} onKeyDown={(e) => onKeyDown(e, confirmLink)} placeholder="______" maxLength={6} disabled={loading} autoFocus />
            </label>
            {error && <div className="studio-login__error">{error}</div>}
            <button className="studio-btn studio-btn--primary studio-login__submit" type="submit" disabled={loading}>
              {loading ? 'Привязываем…' : 'Привязать и войти'}
            </button>
            <p style={{ marginTop: 12, fontSize: 13, textAlign: 'center' }}>
              <button type="button" className="studio-linklike" onClick={() => { setStep('form'); setError(null); setLinkCode('') }} disabled={loading}>Указать другой e-mail</button>
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
