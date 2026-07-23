'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

/**
 * Регистрация автора (/signup). Основная CTA лендинга ведёт сюда.
 *
 * Два поля: имя и email. Пароль генерирует сервер (/api/register-author) и
 * возвращает один раз — показываем на экране (позже продублируем письмом).
 * Название проекта и адрес спрашиваем дальше в мастере онбординга.
 *
 * Поток: register-author → /api/users/login (той же сгенерированной парой) →
 * экран с паролем → /studio (гейт уводит в онбординг).
 *
 * Тема наследуется со страницы на страницу: (frontend)/layout ставит
 * theme-dark/theme-light на <html> из localStorage (общего с лендингом),
 * а токены ниже заданы для обеих тем.
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
      // Автологин той же сгенерированной парой — Payload ставит httpOnly-куку.
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
      /* clipboard недоступен — пользователь скопирует вручную */
    }
  }

  function goStudio() {
    router.replace('/studio')
    router.refresh()
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
        {!created ? (
          <>
            <div className="signup__head">
              <div className="signup__eyebrow">КОНТЕНТ БОКС</div>
              <h1 className="signup__title">Создать проект</h1>
              <p className="signup__lede">
                Свой сайт подписки за пару минут. Дальше — короткая настройка бренда.
              </p>
            </div>

            <form className="signup__form" onSubmit={handleSubmit}>
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
                  autoFocus
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

              {error && <div className="signup__error">{error}</div>}

              <button className="signup__submit" type="submit" disabled={loading}>
                {loading ? 'Создаём…' : 'Создать проект'}
              </button>

              <div className="signup__note">
                Пароль сгенерируем автоматически и покажем на следующем шаге — сохраните его.
              </div>
            </form>

            <div className="signup__foot">
              Уже есть аккаунт? <Link href="/studio/login">Войти</Link>
            </div>
          </>
        ) : (
          <div className="signup__done">
            <div className="signup__eyebrow">КОНТЕНТ БОКС</div>
            <h1 className="signup__title">Проект создан</h1>
            <p className="signup__lede">
              Сохраните пароль — мы показываем его один раз. Позже его можно сменить в настройках студии.
            </p>

            <div className="signup__creds">
              <div className="signup__cred">
                <span className="signup__label">Email</span>
                <div className="signup__cred-val">{created.email}</div>
              </div>
              <div className="signup__cred">
                <span className="signup__label">Пароль</span>
                <div className="signup__cred-row">
                  <code className="signup__cred-val signup__cred-pass">{created.password}</code>
                  <button type="button" className="signup__copy" onClick={copyPassword}>
                    {copied ? 'Скопировано' : 'Копировать'}
                  </button>
                </div>
              </div>
            </div>

            <div className="signup__warn">
              Запишите пароль в надёжное место. Данные для входа отправим и на почту, когда будет подключена рассылка.
            </div>

            <button className="signup__submit" type="button" onClick={goStudio}>
              Продолжить настройку →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

const SIGNUP_CSS = `
.signup {
  --sans:'IBM Plex Sans', ui-sans-serif, system-ui, sans-serif;
  --mono:'IBM Plex Mono', ui-monospace, Menlo, monospace;
  --glass: color-mix(in srgb, var(--surface) 60%, transparent);
  position:relative; min-height:100vh; display:flex; align-items:center; justify-content:center;
  padding:40px 20px; background:var(--bg); color:var(--text);
  font-family:var(--sans); -webkit-font-smoothing:antialiased;
}
/* Тёмная тема (по умолчанию) */
.theme-dark .signup, .signup {
  --bg:#0a0a0b; --surface:#131316; --surface-2:#1a1a1e;
  --border:#26262c; --border-strong:#35353d;
  --text:#f4f4f5; --muted:#a1a1aa; --faint:#6b6b74;
  --accent:#ffffff; --accent-text:#0a0a0b; --accent-hover:#e4e4e7;
  --danger:#f87171; --mesh-op:1;
}
/* Светлая тема — наследуется с лендинга */
.theme-light .signup {
  --bg:#fafafa; --surface:#ffffff; --surface-2:#f4f4f5;
  --border:#e4e4e7; --border-strong:#d4d4d8;
  --text:#18181b; --muted:#52525b; --faint:#a1a1aa;
  --accent:#18181b; --accent-text:#ffffff; --accent-hover:#27272a;
  --danger:#dc2626; --mesh-op:.5;
}
.signup__bg { position:fixed; inset:0; z-index:0; overflow:hidden; pointer-events:none; }
.signup__mesh {
  position:absolute; inset:-20%; opacity:var(--mesh-op, 1);
  background:
    radial-gradient(40% 40% at 20% 15%, rgba(124,58,237,.20), transparent 70%),
    radial-gradient(35% 35% at 85% 20%, rgba(56,189,248,.14), transparent 70%),
    radial-gradient(45% 45% at 60% 90%, rgba(244,114,182,.12), transparent 70%);
  filter:blur(30px);
}
.signup__grid {
  position:absolute; inset:0; opacity:.4;
  background-image:
    linear-gradient(to right, color-mix(in srgb, var(--text) 4%, transparent) 1px, transparent 1px),
    linear-gradient(to bottom, color-mix(in srgb, var(--text) 4%, transparent) 1px, transparent 1px);
  background-size:48px 48px;
  mask-image:radial-gradient(circle at 50% 40%, #000 30%, transparent 75%);
}
.signup__card {
  position:relative; z-index:1; width:100%; max-width:440px;
  background:var(--glass); backdrop-filter:blur(20px) saturate(1.4);
  border:1px solid var(--border-strong); border-radius:16px;
  box-shadow:0 1px 0 color-mix(in srgb, #fff 6%, transparent) inset, 0 30px 60px rgba(0,0,0,.35);
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
  cursor:pointer; transition:background .15s ease; width:100%;
}
.signup__submit:hover:not(:disabled) { background:var(--accent-hover); }
.signup__submit:disabled { opacity:.6; cursor:default; }
.signup__note { font-family:var(--mono); font-size:12px; color:var(--faint); text-align:center; }
.signup__foot { margin-top:22px; text-align:center; font-size:14px; color:var(--muted); }
.signup__foot a { color:var(--text); text-decoration:underline; }
/* Экран с данными для входа */
.signup__done { display:flex; flex-direction:column; }
.signup__creds { display:flex; flex-direction:column; gap:14px; margin:22px 0 16px; }
.signup__cred { display:flex; flex-direction:column; gap:6px; }
.signup__cred-val {
  font-size:15px; color:var(--text); background:var(--surface-2);
  border:1px solid var(--border); border-radius:10px; padding:11px 13px; word-break:break-all;
}
.signup__cred-row { display:flex; gap:8px; align-items:stretch; }
.signup__cred-pass { flex:1; font-family:var(--mono); letter-spacing:.04em; }
.signup__copy {
  padding:0 14px; font-size:13px; font-family:var(--mono); white-space:nowrap; cursor:pointer;
  color:var(--text); background:var(--surface-2); border:1px solid var(--border); border-radius:10px;
  transition:background .15s ease, border-color .15s ease;
}
.signup__copy:hover { border-color:var(--border-strong); }
.signup__warn {
  font-size:13px; color:var(--muted); line-height:1.5; margin-bottom:18px;
  background:color-mix(in srgb, var(--accent) 8%, transparent);
  border:1px solid var(--border); border-radius:10px; padding:11px 13px;
}
@media (max-width:480px){ .signup__card { padding:28px 22px; } }
`
