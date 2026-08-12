'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatPhoneInput } from '@/lib/phone'
import { Mail, Phone, Shield, Building2, LogOut, Check, Loader2, User } from 'lucide-react'
import { displayEmail } from '@/lib/authEmail'

export function ProfileView({
  name,
  email,
  emailVerified,
  isPhoneAuthor,
  phone,
  roleLabel,
  tenantName,
}: {
  name: string
  email: string
  emailVerified: boolean
  isPhoneAuthor: boolean
  phone: string | null
  roleLabel: string
  tenantName: string
}) {
  const emailShown = displayEmail(email)
  return (
    <>
      <div className="studio-page-head">
        <div>
          <h1>Профиль</h1>
          <div className="studio-page-head__sub">Ваш аккаунт автора</div>
        </div>
      </div>

      <div className="settings">
        <InfoBlock name={name} email={emailShown} emailVerified={emailVerified} phone={phone} roleLabel={roleLabel} tenantName={tenantName} />
        <IdentityBlock currentName={name} currentEmail={emailShown} canEditEmail={isPhoneAuthor} emailVerified={emailVerified} />
        <PhoneBlock currentPhone={phone} />
        {!isPhoneAuthor && <PasswordBlock />}
        {!isPhoneAuthor && <EmailBlock currentEmail={email} />}
        <LogoutBlock />
      </div>
    </>
  )
}

/* Инфо (просмотр) */
function InfoBlock({ name, email, emailVerified, phone, roleLabel, tenantName }: { name: string; email: string | null; emailVerified: boolean; phone: string | null; roleLabel: string; tenantName: string }) {
  return (
    <section className="settings__block">
      <div className="settings__block-head">
        <h2>Аккаунт</h2>
        <p>Основная информация о вашем профиле.</p>
      </div>
      <div className="profile__info">
        <div className="profile__info-row">
          <User size={16} className="profile__info-icon" />
          <span className="profile__info-label">Имя</span>
          <span className="profile__info-value">{name || 'не указано'}</span>
        </div>
        <div className="profile__info-row">
          <Mail size={16} className="profile__info-icon" />
          <span className="profile__info-label">Email</span>
          <span className="profile__info-value">{email ? (emailVerified ? email : `${email} · не подтверждён`) : 'не указан'}</span>
        </div>
        <div className="profile__info-row">
          <Phone size={16} className="profile__info-icon" />
          <span className="profile__info-label">Телефон</span>
          <span className="profile__info-value">{phone || 'не привязан'}</span>
        </div>
        <div className="profile__info-row">
          <Shield size={16} className="profile__info-icon" />
          <span className="profile__info-label">Роль</span>
          <span className="profile__info-value">{roleLabel}</span>
        </div>
        {tenantName && (
          <div className="profile__info-row">
            <Building2 size={16} className="profile__info-icon" />
            <span className="profile__info-label">Сайт</span>
            <span className="profile__info-value">{tenantName}</span>
          </div>
        )}
      </div>
    </section>
  )
}

/* Имя и e-mail (без пароля) — для телефонных авторов */
function IdentityBlock({ currentName, currentEmail, canEditEmail, emailVerified }: { currentName: string; currentEmail: string | null; canEditEmail: boolean; emailVerified: boolean }) {
  const router = useRouter()
  const [name, setName] = useState(currentName || '')
  const [email, setEmail] = useState(currentEmail || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function submit() {
    setError(null); setDone(false)
    const payload: { name: string; email?: string } = { name: name.trim() }
    if (canEditEmail) payload.email = email.trim()
    setBusy(true)
    try {
      const res = await fetch('/studio/api/profile/identity', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify(payload),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) { setError(json.error || 'Не удалось сохранить'); setBusy(false); return }
      setDone(true); setBusy(false); router.refresh()
    } catch { setError('Ошибка соединения'); setBusy(false) }
  }

  return (
    <section className="settings__block">
      <div className="settings__block-head">
        <h2>{canEditEmail ? 'Имя и e-mail' : 'Имя'}</h2>
        <p>{canEditEmail ? 'Как вас зовут и на какой e-mail присылать уведомления.' : 'Отображаемое имя автора.'}</p>
      </div>
      <div className="profile__form">
        <label className="studio-field">
          <span className="studio-field__label">Имя</span>
          <input className="studio-input" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Как вас зовут" />
        </label>
        {canEditEmail && (
          <label className="studio-field">
            <span className="studio-field__label">E-mail{currentEmail && !emailVerified ? ' · не подтверждён' : ''}</span>
            <input className="studio-input" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </label>
        )}
        {error && <div className="settings__err">{error}</div>}
        <div className="settings__save-row">
          {done && <span className="settings__saved"><Check size={15} /> Сохранено</span>}
          <button className="studio-btn studio-btn--primary" onClick={submit} disabled={busy}>
            {busy ? <Loader2 size={16} className="spin" /> : null} Сохранить
          </button>
        </div>
      </div>
    </section>
  )
}

/* Телефон: привязка/смена по SMS-коду */
function PhoneBlock({ currentPhone }: { currentPhone: string | null }) {
  const router = useRouter()
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<'phone' | 'code'>('phone')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function sendCode() {
    setError(null); setDone(false)
    if (!phone.trim()) { setError('Введите номер телефона'); return }
    setBusy(true)
    try {
      const res = await fetch('/studio/api/auth/phone/request', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ phone, mode: 'register' }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) { setError(json.error || 'Не удалось отправить код'); setBusy(false); return }
      setStep('code'); setBusy(false)
    } catch { setError('Ошибка соединения'); setBusy(false) }
  }

  async function saveCode() {
    setError(null)
    if (code.replace(/\D/g, '').length < 4) { setError('Введите код из SMS'); return }
    setBusy(true)
    try {
      const res = await fetch('/studio/api/profile/phone', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ phone, code }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) { setError(json.error || 'Не удалось сохранить'); setBusy(false); return }
      setDone(true); setStep('phone'); setCode(''); setPhone(''); setBusy(false)
      router.refresh()
    } catch { setError('Ошибка соединения'); setBusy(false) }
  }

  return (
    <section className="settings__block">
      <div className="settings__block-head">
        <h2>Телефон</h2>
        <p>{currentPhone ? 'Вход в студию по SMS-коду. Можно изменить номер.' : 'Привяжите номер, чтобы входить в студию по SMS-коду.'}</p>
      </div>
      <div className="profile__form">
        {step === 'phone' ? (
          <>
            <label className="studio-field">
              <span className="studio-field__label">{currentPhone ? 'Новый номер' : 'Номер телефона'}</span>
              <input className="studio-input" type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(formatPhoneInput(e.target.value))} placeholder="+7 900 000 00 00" />
            </label>
            {error && <div className="settings__err">{error}</div>}
            <div className="settings__save-row">
              {done && <span className="settings__saved"><Check size={15} /> Телефон привязан</span>}
              <button className="studio-btn studio-btn--primary" onClick={sendCode} disabled={busy}>
                {busy ? <Loader2 size={16} className="spin" /> : null} Получить код
              </button>
            </div>
          </>
        ) : (
          <>
            <label className="studio-field">
              <span className="studio-field__label">Код из SMS</span>
              <input className="studio-input" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} placeholder="______" autoFocus />
            </label>
            {error && <div className="settings__err">{error}</div>}
            <div className="settings__save-row">
              <button className="studio-btn studio-btn--ghost" onClick={() => { setStep('phone'); setError(null) }} disabled={busy}>Изменить номер</button>
              <button className="studio-btn studio-btn--primary" onClick={saveCode} disabled={busy}>
                {busy ? <Loader2 size={16} className="spin" /> : null} Подтвердить
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  )
}

/* Смена пароля */
function PasswordBlock() {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function submit() {
    setError(null)
    setDone(false)
    if (!current || !next) {
      setError('Заполните все поля')
      return
    }
    if (next.length < 8) {
      setError('Новый пароль — минимум 8 символов')
      return
    }
    if (next !== confirm) {
      setError('Пароли не совпадают')
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/studio/api/profile/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      })
      const json = await res.json()
      if (!res.ok) setError(json.error || 'Не удалось сменить пароль')
      else {
        setDone(true)
        setCurrent('')
        setNext('')
        setConfirm('')
      }
    } catch {
      setError('Ошибка соединения')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="settings__block">
      <div className="settings__block-head">
        <h2>Смена пароля</h2>
        <p>Введите текущий пароль и новый.</p>
      </div>
      <div className="profile__form">
        <label className="studio-field">
          <span className="studio-field__label">Текущий пароль</span>
          <input
            className="studio-input"
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
        </label>
        <label className="studio-field">
          <span className="studio-field__label">Новый пароль</span>
          <input
            className="studio-input"
            type="password"
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
          />
        </label>
        <label className="studio-field">
          <span className="studio-field__label">Повторите новый пароль</span>
          <input
            className="studio-input"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </label>

        {error && <div className="settings__err">{error}</div>}

        <div className="settings__save-row">
          {done && <span className="settings__saved"><Check size={15} /> Пароль изменён</span>}
          <button className="studio-btn studio-btn--primary" onClick={submit} disabled={busy}>
            {busy ? <Loader2 size={16} className="spin" /> : null}
            Сменить пароль
          </button>
        </div>
      </div>
    </section>
  )
}

/* Смена email */
function EmailBlock({ currentEmail }: { currentEmail: string }) {
  const router = useRouter()
  const [newEmail, setNewEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function submit() {
    setError(null)
    setDone(false)
    if (!newEmail.trim() || !password) {
      setError('Заполните оба поля')
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/studio/api/profile/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ newEmail: newEmail.trim(), password }),
      })
      const json = await res.json()
      if (!res.ok) setError(json.error || 'Не удалось сменить email')
      else {
        setDone(true)
        setPassword('')
        router.refresh()
      }
    } catch {
      setError('Ошибка соединения')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="settings__block">
      <div className="settings__block-head">
        <h2>Смена email</h2>
        <p>Email — это ваш логин. Подтвердите паролем.</p>
      </div>
      <div className="profile__form">
        <label className="studio-field">
          <span className="studio-field__label">Новый email</span>
          <input
            className="studio-input"
            type="email"
            placeholder={currentEmail}
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
          />
        </label>
        <label className="studio-field">
          <span className="studio-field__label">Пароль для подтверждения</span>
          <input
            className="studio-input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        {error && <div className="settings__err">{error}</div>}

        <div className="settings__save-row">
          {done && <span className="settings__saved"><Check size={15} /> Email изменён</span>}
          <button className="studio-btn studio-btn--primary" onClick={submit} disabled={busy}>
            {busy ? <Loader2 size={16} className="spin" /> : null}
            Сменить email
          </button>
        </div>
      </div>
    </section>
  )
}

/* Выход */
function LogoutBlock() {
  return (
    <section className="settings__block">
      <div className="settings__block-head">
        <h2>Выход</h2>
        <p>Завершить сессию в студии.</p>
      </div>
      <a href="/studio/logout" className="studio-btn studio-btn--ghost profile__logout">
        <LogOut size={16} />
        Выйти из аккаунта
      </a>
    </section>
  )
}
