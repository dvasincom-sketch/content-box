'use client'

import { useState, type ChangeEvent, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { EmailCaptureForm } from '@/components/EmailCaptureForm'

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
type PhoneStep = 'phone' | 'code' | 'email'

export function LoginForm({ remembered = null }: { remembered?: string | null }) {
  const router = useRouter()
  // Телефон — основной способ (подтверждение по звонку, без пароля). Email —
  // альтернатива. Если браузер помнит телефонный аккаунт (remembered), тоже
  // открываем «По телефону» — вход одним кликом без звонка.
  const [mode, setMode] = useState<Mode>('phone')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<PhoneStep>('phone')
  const [remember, setRemember] = useState(true)
  // Показать обычную форму ввода телефона вместо карточки «запомненного» аккаунта.
  const [useOtherNumber, setUseOtherNumber] = useState(false)

  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Возврат на страницу, с которой пришли на /login (?redirect=…). Читаем из
  // location, а не через useSearchParams — чтобы не требовать Suspense-обёртку.
  // Пускаем ТОЛЬКО внутренние пути (один ведущий '/', не '//') — защита от
  // открытого редиректа на чужой домен.
  function safeRedirect(): string {
    try {
      const p = new URLSearchParams(window.location.search).get('redirect') || ''
      if (p.startsWith('/') && !p.startsWith('//')) return p
    } catch {
      /* ignore */
    }
    return '/'
  }
  function done() {
    router.push(safeRedirect())
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

  // Вход по доверенному устройству одним кликом (кука cb_td), без ввода
  // телефона и без SMS. Телефон сервер достаёт из подписанной куки сам.
  async function continueTrusted() {
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/auth/phone/continue', {
        method: 'POST',
        credentials: 'include',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        // Кука протухла/аккаунт исчез — откатываемся к обычному вводу номера.
        setUseOtherNumber(true)
        setError('Не удалось войти автоматически. Введите номер телефона.')
        setLoading(false)
        return
      }
      if (data?.needsEmail) {
        setStep('email')
        setLoading(false)
        return
      }
      done()
    } catch {
      setError('Сетевая ошибка. Попробуйте ещё раз.')
      setLoading(false)
    }
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
      // Нет реального подтверждённого email (телефонная регистрация) — сначала
      // просим указать почту, потом пускаем дальше. Шаг пропускаемый.
      if (data?.needsEmail) {
        setStep('email')
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
          <button type="button" role="tab" aria-selected={mode === 'email'} className={`auth__tab${mode === 'email' ? ' is-active' : ''}`} onClick={() => switchMode('email')}>
            По email
          </button>
          <button type="button" role="tab" aria-selected={mode === 'phone'} className={`auth__tab${mode === 'phone' ? ' is-active' : ''}`} onClick={() => switchMode('phone')}>
            По телефону
          </button>
        </div>

        {mode === 'phone' ? (
          step === 'phone' && remembered && !useOtherNumber ? (
            <div className="auth__form">
              <p className="auth__hint" style={{ marginTop: 0 }}>
                Этот браузер помнит ваш аккаунт. Войдите без звонка.
              </p>
              <button type="button" disabled={loading} className="auth__btn" onClick={continueTrusted}>
                {loading ? 'Входим…' : `Продолжить как ${remembered}`}
              </button>
              {error && <p className="auth__error">{error}</p>}
              <div className="auth__resend">
                <button
                  type="button"
                  className="auth__link-btn"
                  onClick={() => {
                    setUseOtherNumber(true)
                    setError(null)
                  }}
                >
                  Войти под другим номером
                </button>
              </div>
            </div>
          ) : step === 'phone' ? (
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
                {loading ? 'Заказываем звонок…' : 'Получить звонок'}
              </button>
              <p className="auth__hint">Вам поступит звонок — отвечать не нужно. Код — это <b>последние 4 цифры</b> номера, с которого позвонят. Вход без пароля; если аккаунта ещё нет, создадим автоматически.</p>
            </form>
          ) : step === 'code' ? (
            <form className="auth__form" onSubmit={submitCode}>
              <div className="auth__field">
                <label className="auth__label" htmlFor="auth-code">Последние 4 цифры номера звонка</label>
                <input
                  id="auth-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  className="auth__input"
                  placeholder="____"
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
              <p className="auth__hint" style={{ marginTop: 0 }}>
                Звонок не поступил? Проверьте номер и закажите звонок ещё раз или войдите <b>по email</b>.
              </p>
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
          ) : (
            <div className="auth__form">
              <div className="auth__field">
                <label className="auth__label">Укажите email</label>
                <p className="auth__hint" style={{ marginTop: 0 }}>
                  Нужен для еженедельной рассылки и важных уведомлений о профиле. Пришлём письмо со ссылкой для подтверждения.
                </p>
              </div>
              <EmailCaptureForm submitLabel="Сохранить и подтвердить" />
              <div className="auth__resend">
                <button type="button" className="auth__link-btn" onClick={done}>
                  Продолжить →
                </button>
              </div>
            </div>
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
