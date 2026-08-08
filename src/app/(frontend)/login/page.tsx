'use client'

import { useState, type ChangeEvent, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

/**
 * Вход подписчика (/login). Два способа:
 *  • «По телефону» — SMS-код (пассворлесс), /api/auth/phone/request → verify.
 *    Доверенное устройство помнится 30 дней и логинит без SMS.
 *  • «По email» — дефолтный /api/subscribers/login (пароль, httpOnly-cookie).
 * Оба — коллекция subscribers, не users (админы). Разные эндпоинты/cookie.
 */
/** Прогрессивная маска телефона РФ: +7 (900) 000 00 00. */
function maskPhoneInput(raw: string, prev: string): string {
  if (raw === '') return ''
  const toFull = (v: string) => {
    let x = v.replace(/\D/g, '')
    if (x[0] === '8') x = '7' + x.slice(1)
    if (x && x[0] !== '7') x = '7' + x
    return x.slice(0, 11)
  }
  let d = toFull(raw)
  // удаление разделителя (цифры те же, строка короче) — снимаем последнюю цифру
  if (raw.length < prev.length && d === toFull(prev)) d = d.slice(0, -1)
  if (d.length <= 1) return raw.length < prev.length ? '' : '+7'
  const r = d.slice(1)
  let out = '+7 (' + r.slice(0, 3)
  if (r.length >= 3) out += ')'
  if (r.length > 3) out += ' ' + r.slice(3, 6)
  if (r.length > 6) out += ' ' + r.slice(6, 8)
  if (r.length > 8) out += ' ' + r.slice(8, 10)
  return out
}

type Mode = 'phone' | 'email'
type PhoneStep = 'phone' | 'code'

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('phone')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<PhoneStep>('phone')
  const [remember, setRemember] = useState(true)

  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  function done() {
    router.push('/')
    router.refresh()
  }
  function switchMode(m: Mode) {
    setMode(m)
    setError(null)
  }

  async function handleEmail(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/subscribers/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      })
      if (!res.ok) {
        setError('Неверный email или пароль.')
        setLoading(false)
        return
      }
      done()
    } catch {
      setError('Сетевая ошибка. Попробуйте ещё раз.')
      setLoading(false)
    }
  }

  function onPhoneChange(e: ChangeEvent<HTMLInputElement>) {
    setPhone(maskPhoneInput(e.target.value, phone))
  }

  async function requestCode(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/auth/phone/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data?.error || 'Не удалось отправить код.')
        setLoading(false)
        return
      }
      if (data?.loggedIn) {
        done()
        return
      }
      setStep('code')
      setLoading(false)
    } catch {
      setError('Сетевая ошибка. Попробуйте ещё раз.')
      setLoading(false)
    }
  }

  async function submitCode(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/auth/phone/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code, remember }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data?.error || 'Неверный код.')
        setLoading(false)
        return
      }
      done()
    } catch {
      setError('Сетевая ошибка. Попробуйте ещё раз.')
      setLoading(false)
    }
  }

  return (
    <div className="auth">
      <div className="auth__card">
        <div className="auth__head">
          <h1 className="auth__title">С возвращением</h1>
          <p className="auth__sub">Войдите, чтобы продолжить смотреть</p>
        </div>

        <div className="auth__tabs" role="tablist">
          <button type="button" role="tab" aria-selected={mode === 'phone'} className={`auth__tab${mode === 'phone' ? ' is-active' : ''}`} onClick={() => switchMode('phone')}>
            По телефону
          </button>
          <button type="button" role="tab" aria-selected={mode === 'email'} className={`auth__tab${mode === 'email' ? ' is-active' : ''}`} onClick={() => switchMode('email')}>
            По email
          </button>
        </div>

        {mode === 'phone' ? (
          step === 'phone' ? (
            <form className="auth__form" onSubmit={requestCode}>
              <div className="auth__field">
                <label className="auth__label" htmlFor="auth-phone">Телефон</label>
                <input
                  id="auth-phone"
                  type="tel"
                  inputMode="tel"
                  value={phone}
                  onChange={onPhoneChange}
                  className="auth__input"
                  autoComplete="tel"
                  placeholder="+7 (900) 000 00 00"
                  maxLength={18}
                  required
                />
              </div>
              {error && <p className="auth__error">{error}</p>}
              <button type="submit" disabled={loading} className="auth__btn">
                {loading ? 'Отправляем…' : 'Получить код'}
              </button>
              <p className="auth__hint">Пришлём SMS с кодом — вход без пароля. Если аккаунта ещё нет, создадим автоматически.</p>
            </form>
          ) : (
            <form className="auth__form" onSubmit={submitCode}>
              <div className="auth__field">
                <label className="auth__label" htmlFor="auth-code">Код из SMS</label>
                <input
                  id="auth-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="auth__input"
                  placeholder="______"
                  required
                  autoFocus
                />
              </div>
              <label className="auth__remember">
                <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                Запомнить это устройство на 30 дней
              </label>
              {error && <p className="auth__error">{error}</p>}
              <button type="submit" disabled={loading} className="auth__btn">
                {loading ? 'Проверяем…' : 'Войти'}
              </button>
              <div className="auth__resend">
                <button
                  type="button"
                  className="auth__link-btn"
                  onClick={() => {
                    setStep('phone')
                    setCode('')
                    setError(null)
                  }}
                >
                  ← Изменить номер
                </button>
              </div>
            </form>
          )
        ) : (
          <form className="auth__form" onSubmit={handleEmail}>
            <div className="auth__field">
              <label className="auth__label" htmlFor="auth-email">Email</label>
              <input
                id="auth-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="auth__input"
                autoComplete="email"
                placeholder="you@example.com"
                required
              />
            </div>
            <div className="auth__field">
              <label className="auth__label" htmlFor="auth-pass">Пароль</label>
              <input
                id="auth-pass"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="auth__input"
                autoComplete="current-password"
                placeholder="••••••••"
                required
              />
            </div>
            {error && <p className="auth__error">{error}</p>}
            <button type="submit" disabled={loading} className="auth__btn">
              {loading ? 'Входим…' : 'Войти'}
            </button>
          </form>
        )}

        <div className="auth__links">
          {mode === 'email' && (
            <Link href="/forgot-password" className="auth__link">Забыли пароль?</Link>
          )}
          <span className="auth__reg">
            Нет аккаунта? <Link href="/register" className="auth__link auth__link--accent">Зарегистрироваться</Link>
          </span>
        </div>
      </div>
    </div>
  )
}
