'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BrandLogo } from '@/components/studio/BrandLogo'

/**
 * Регистрация автора (/signup) — визуальный «брат» экрана /studio/login:
 * тот же фон, стеклянная карточка и элементы формы студии (классы .studio-*).
 *
 * Два поля (имя, email). Пароль генерирует сервер (/api/register-author) и
 * возвращает один раз — показываем на экране (позже продублируем письмом).
 * После успеха: автологин (/api/users/login) → «Продолжить настройку» → /studio.
 */
export default function SignupPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null)
  const [copied, setCopied] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Укажите корректный email.')
      return
    }
    setLoading(true)
    try {
      const regRes = await fetch('/api/register-author', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name }),
      })
      const regData = await regRes.json().catch(() => ({}))
      if (!regRes.ok) {
        setError(regData.error || 'Не удалось зарегистрироваться.')
        setLoading(false)
        return
      }
      const password: string = regData.password
      await fetch('/api/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: regData.email, password }),
      }).catch(() => {})
      setCreated({ email: regData.email, password })
      setLoading(false)
    } catch {
      setError('Сетевая ошибка. Попробуйте ещё раз.')
      setLoading(false)
    }
  }

  async function copyPassword() {
    if (!created) return
    try {
      await navigator.clipboard.writeText(created.password)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard недоступен */
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleSubmit(e as unknown as React.FormEvent)
  }

  return (
    <div className="studio-login">
      <style>{SU_CSS}</style>
      <div className="studio-login__bg" aria-hidden>
        <span className="studio-login__grid" />
      </div>

      <div className="studio-login__card">
        {!created ? (
          <>
            <div className="studio-login__head">
              <div className="studio-login__logo">
                <BrandLogo size={44} blink />
              </div>
              <h1>Создать проект</h1>
              <p>Контент Бокс · регистрация автора</p>
            </div>

            <form className="studio-login__form" onSubmit={handleSubmit}>
              <label className="studio-field">
                <span className="studio-field__label">Имя</span>
                <input
                  className="studio-input"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder="Как к вам обращаться"
                  autoComplete="name"
                  disabled={loading}
                  autoFocus
                />
              </label>

              <label className="studio-field">
                <span className="studio-field__label">Почта</span>
                <input
                  className="studio-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder="you@example.com"
                  autoComplete="email"
                  disabled={loading}
                  required
                />
              </label>

              {error && <div className="studio-login__error">{error}</div>}

              <button
                className="studio-btn studio-btn--primary studio-login__submit"
                type="submit"
                disabled={loading}
              >
                {loading ? 'Создаём…' : 'Создать проект'}
              </button>

              <p className="su-note">Пароль сгенерируем автоматически и покажем на следующем шаге — сохраните его.</p>
            </form>

            <div className="su-alt">
              Уже есть аккаунт? <a href="/studio/login">Войти</a>
            </div>
          </>
        ) : (
          <div className="su-done">
            <div className="studio-login__head">
              <div className="studio-login__logo">
                <BrandLogo size={44} />
              </div>
              <h1>Проект создан</h1>
              <p>Сохраните пароль — показываем один раз</p>
            </div>

            <div className="su-creds">
              <div className="su-cred">
                <span className="studio-field__label">Почта</span>
                <div className="su-val">{created.email}</div>
              </div>
              <div className="su-cred">
                <span className="studio-field__label">Пароль</span>
                <div className="su-row">
                  <code className="su-val su-pass">{created.password}</code>
                  <button type="button" className="studio-btn su-copy" onClick={copyPassword}>
                    {copied ? 'Скопировано' : 'Копировать'}
                  </button>
                </div>
              </div>
            </div>

            <div className="su-warn">
              Запишите пароль в надёжное место. Позже его можно сменить в настройках студии.
            </div>

            <button
              className="studio-btn studio-btn--primary studio-login__submit"
              type="button"
              onClick={() => {
                router.replace('/studio')
                router.refresh()
              }}
            >
              Продолжить настройку →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

const SU_CSS = `
.su-note { font-family: var(--st-font-mono); font-size: var(--st-text-xs, 12px); color: var(--st-text-faint); text-align: center; margin: 4px 0 0; line-height: 1.5; }
.su-alt { margin-top: var(--st-space-5); text-align: center; font-size: var(--st-text-sm); color: var(--st-text-muted); }
.su-alt a { color: var(--st-text); text-decoration: underline; }
.su-creds { display: flex; flex-direction: column; gap: var(--st-space-4); margin-bottom: var(--st-space-4); }
.su-cred { display: flex; flex-direction: column; gap: var(--st-space-2); }
.su-val {
  font-size: var(--st-text-base); color: var(--st-text);
  background: color-mix(in srgb, var(--st-surface-2) 70%, transparent);
  border: 1px solid var(--st-border); border-radius: var(--st-radius-sm);
  padding: var(--st-space-3); word-break: break-all;
}
.su-row { display: flex; gap: var(--st-space-2); align-items: stretch; }
.su-pass { flex: 1; font-family: var(--st-font-mono); letter-spacing: .04em; }
.su-copy { white-space: nowrap; }
.su-warn {
  font-size: var(--st-text-sm); color: var(--st-text-muted); line-height: 1.5;
  background: color-mix(in srgb, var(--st-accent) 8%, transparent);
  border: 1px solid var(--st-border); border-radius: var(--st-radius-sm);
  padding: var(--st-space-3); margin-bottom: var(--st-space-4);
}
`
