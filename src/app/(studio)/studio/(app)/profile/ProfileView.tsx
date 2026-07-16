'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Mail, Shield, Building2, LogOut, Check, Loader2 } from 'lucide-react'

export function ProfileView({
  email,
  roleLabel,
  tenantName,
}: {
  email: string
  roleLabel: string
  tenantName: string
}) {
  return (
    <>
      <div className="studio-page-head">
        <div>
          <h1>Профиль</h1>
          <div className="studio-page-head__sub">Ваш аккаунт автора</div>
        </div>
      </div>

      <div className="settings">
        <InfoBlock email={email} roleLabel={roleLabel} tenantName={tenantName} />
        <PasswordBlock />
        <EmailBlock currentEmail={email} />
        <LogoutBlock />
      </div>
    </>
  )
}

/* Инфо (просмотр) */
function InfoBlock({ email, roleLabel, tenantName }: { email: string; roleLabel: string; tenantName: string }) {
  return (
    <section className="settings__block">
      <div className="settings__block-head">
        <h2>Аккаунт</h2>
        <p>Основная информация о вашем профиле.</p>
      </div>
      <div className="profile__info">
        <div className="profile__info-row">
          <Mail size={16} className="profile__info-icon" />
          <span className="profile__info-label">Email</span>
          <span className="profile__info-value">{email}</span>
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
