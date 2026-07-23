'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

/**
 * Регистрация автора (/signup). Основная CTA лендинга ведёт сюда.
 *
 * Поток: POST /api/register-author (создаёт tenant+user+site-settings) →
 * POST /api/users/login (httpOnly-кука, общая со студией/админкой) → /studio,
 * где гейт уводит в мастер онбординга.
 *
 * Стиль — под лендинг (тёмная палитра, стекло/mesh, IBM Plex). Страница
 * самодостаточна: свои токены и шрифты, не зависит от тенантных brand-переменных
 * (на платформенном хосте тенанта нет).
 */
export default function SignupPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [projectName, setProjectName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!projectName.trim()) {
      setError('Укажите название проекта.')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Укажите корректный email.')
      return
    }
    if (password.length < 8) {
      setError('Пароль должен быть не короче 8 символов.')
      return
    }

    setLoading(true)
    try {
      const regRes = await fetch('/api/register-author', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name, projectName }),
      })
      const regData = await regRes.json().catch(() => ({}))
      if (!regRes.ok) {
        setError(regData.error || 'Не удалось зарегистрироваться.')
        setLoading(false)
        return
      }

      // Автологин — Payload ставит httpOnly-куку (та же сессия, что у студии).
      const loginRes = await fetch('/api/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      })
      if (!loginRes.ok) {
        // Аккаунт создан, но автологин не прошёл — уводим на вход.
        router.push('/studio/login')
        return
      }

      // Гейт в студии уведёт в /studio/onboarding.
      router.replace('/studio')
      router.refresh()
    } catch {
      setError('Сетевая ошибка. Попробуйте ещё раз.')
      setLoading(false)
    }
  }

  return (
    <div className="signup">
      {/* IBM Plex — как на лендинге. React 19 поднимет тег в <head>. */}
      <link
        href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap"
        rel="stylesheet"
      />
      <style>{SIGNUP_CSS}</style>

      <div className="signup__bg" aria-hidden>
        <span className="signup__mesh" />
        <span className="signup__grid" />
      </div>

      <div className="signup__card">
        <div className="signup__head">
          <div className="signup__eyebrow">CONTENT BOX</div>
          <h1 className="signup__title">Создать проект</h1>
          <p className="signup__lede">
            Свой сайт подписки за пару минут. Дальше — короткая настройка бренда.
          </p>
        </div>

        <form className="signup__form" onSubmit={handleSubmit}>
          <label className="signup__field">
            <span className="signup__label">Название проекта</span>
            <input
              className="signup__input"
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="Мой фандом"
              autoComplete="organization"
              disabled={loading}
              autoFocus
            />
          </label>

          <label className="signup__field">
            <span className="signup__label">Имя</span>
            <input
              className="signup__input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Как к вам обращаться"
              autoComplete="name"
              disabled={loading}
            />
          </label>

          <label className="signup__field">
            <span className="signup__label">Email</span>
            <input
              className="signup__input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              disabled={loading}
              required
            />
          </label>

          <label className="signup__field">
            <span className="signup__label">Пароль</span>
            <input
              className="signup__input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Минимум 8 символов"
              autoComplete="new-password"
              disabled={loading}
              required
            />
          </label>

          {error && <div className="signup__error">{error}</div>}

          <button className="signup__submit" type="submit" disabled={loading}>
            {loading ? 'Создаём…' : 'Создать проект'}
          </button>

          <div className="signup__note">Без карты. Настройку можно продолжить позже.</div>
        </form>

        <div className="signup__foot">
          Уже есть аккаунт? <Link href="/studio/login">Войти</Link>
        </div>
      </div>
    </div>
  )
}

const SIGNUP_CSS = `
.signup {
  --bg:#0a0a0b; --surface:#131316; --surface-2:#1a1a1e;
  --border:#26262c; --border-strong:#35353d;
  --text:#f4f4f5; --muted:#a1a1aa; --faint:#6b6b74;
  --accent:#ffffff; --accent-text:#0a0a0b; --accent-hover:#e4e4e7;
  --danger:#f87171;
  --sans:'IBM Plex Sans', ui-sans-serif, system-ui, sans-serif;
  --mono:'IBM Plex Mono', ui-monospace, Menlo, monospace;
  --glass: color-mix(in srgb, var(--surface) 60%, transparent);
  position:relative; min-height:100vh; display:flex; align-items:center; justify-content:center;
  padding:40px 20px; background:var(--bg); color:var(--text);
  font-family:var(--sans); -webkit-font-smoothing:antialiased;
}
.signup__bg { position:fixed; inset:0; z-index:0; overflow:hidden; pointer-events:none; }
.signup__mesh {
  position:absolute; inset:-20%;
  background:
    radial-gradient(40% 40% at 20% 15%, rgba(124,58,237,.20), transparent 70%),
    radial-gradient(35% 35% at 85% 20%, rgba(56,189,248,.14), transparent 70%),
    radial-gradient(45% 45% at 60% 90%, rgba(244,114,182,.12), transparent 70%);
  filter:blur(30px);
}
.signup__grid {
  position:absolute; inset:0; opacity:.4;
  background-image:
    linear-gradient(to right, rgba(255,255,255,.03) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(255,255,255,.03) 1px, transparent 1px);
  background-size:48px 48px;
  mask-image:radial-gradient(circle at 50% 40%, #000 30%, transparent 75%);
}
.signup__card {
  position:relative; z-index:1; width:100%; max-width:440px;
  background:var(--glass); backdrop-filter:blur(20px) saturate(1.4);
  border:1px solid var(--border-strong); border-radius:16px;
  box-shadow:0 1px 0 rgba(255,255,255,.05) inset, 0 30px 60px rgba(0,0,0,.45);
  padding:36px 32px;
}
.signup__head { margin-bottom:24px; }
.signup__eyebrow {
  font-family:var(--mono); font-size:12px; letter-spacing:.14em; color:var(--muted); margin-bottom:12px;
}
.signup__title { font-size:28px; font-weight:600; letter-spacing:-.02em; margin:0 0 8px; }
.signup__lede { font-size:15px; color:var(--muted); line-height:1.5; margin:0; }
.signup__form { display:flex; flex-direction:column; gap:14px; margin-top:8px; }
.signup__field { display:flex; flex-direction:column; gap:6px; }
.signup__label { font-family:var(--mono); font-size:12px; color:var(--muted); }
.signup__input {
  width:100%; padding:12px 14px; font-size:15px; font-family:var(--sans);
  color:var(--text); background:var(--surface-2);
  border:1px solid var(--border); border-radius:10px; outline:none;
  transition:border-color .15s ease;
}
.signup__input:focus { border-color:var(--border-strong); }
.signup__input::placeholder { color:var(--faint); }
.signup__input:disabled { opacity:.6; }
.signup__error {
  font-size:14px; color:var(--danger);
  background:color-mix(in srgb, var(--danger) 12%, transparent);
  border:1px solid color-mix(in srgb, var(--danger) 30%, transparent);
  border-radius:10px; padding:10px 12px;
}
.signup__submit {
  margin-top:4px; padding:13px 18px; font-size:15px; font-weight:600; font-family:var(--sans);
  color:var(--accent-text); background:var(--accent); border:none; border-radius:10px;
  cursor:pointer; transition:background .15s ease;
}
.signup__submit:hover:not(:disabled) { background:var(--accent-hover); }
.signup__submit:disabled { opacity:.6; cursor:default; }
.signup__note { font-family:var(--mono); font-size:12px; color:var(--faint); text-align:center; }
.signup__foot { margin-top:22px; text-align:center; font-size:14px; color:var(--muted); }
.signup__foot a { color:var(--text); text-decoration:underline; }
@media (max-width:480px){ .signup__card { padding:28px 22px; } }
`
