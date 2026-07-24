'use client'
import './onboarding.css'

import React, { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Пошаговый мастер онбординга (возобновляемый). Каждый «Далее» сохраняет поля
 * шага на tenant и двигает onboardingStep, поэтому при возврате мастер
 * открывается на том же месте. Финал ставит onboardingComplete=true → студия.
 *
 * Визуально согласован со студией и экраном входа: фон студийного логина
 * (пятна + сетка), стеклянная карточка .studio-login__card, поля/кнопки .studio-*.
 *
 * Аватар грузится в site-settings.logo через существующий /studio/api/settings/logo.
 * Остальное — через /studio/api/onboarding.
 */

type Initial = {
  name: string
  description: string
  subdomain: string
  category: string
  step: number
  logoUrl: string | null
}

const STEPS = ['Бренд', 'Адрес', 'Категория', 'Аватар', 'Готово']
const LAST = STEPS.length - 1

const CATEGORIES: { value: string; label: string }[] = [
  { value: 'blogger', label: 'Блогер' },
  { value: 'musician', label: 'Музыкант' },
  { value: 'podcaster', label: 'Подкастер' },
  { value: 'streamer', label: 'Стример' },
  { value: 'artist', label: 'Художник' },
  { value: 'education', label: 'Образование' },
  { value: 'other', label: 'Другое' },
]

function sanitizeSub(v: string): string {
  return v.toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').slice(0, 30)
}

export function OnboardingWizard({ initial, email }: { initial: Initial; email: string }) {
  const router = useRouter()
  const [step, setStep] = useState(Math.min(Math.max(initial.step, 0), LAST))
  const [name, setName] = useState(initial.name)
  const [description, setDescription] = useState(initial.description)
  const [subdomain, setSubdomain] = useState(initial.subdomain)
  const [category, setCategory] = useState(initial.category)
  const [logoUrl, setLogoUrl] = useState<string | null>(initial.logoUrl)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function save(fields: Record<string, unknown>): Promise<boolean> {
    setError(null)
    setSaving(true)
    try {
      const res = await fetch('/studio/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(fields),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Не удалось сохранить.')
        return false
      }
      return true
    } catch {
      setError('Сетевая ошибка. Попробуйте ещё раз.')
      return false
    } finally {
      setSaving(false)
    }
  }

  function goBack() {
    setError(null)
    setStep((s) => Math.max(0, s - 1))
  }

  async function next() {
    if (step === 0) {
      if (!name.trim()) {
        setError('Укажите название проекта.')
        return
      }
      const ok = await save({ name, description, step: 1 })
      if (ok) setStep(1)
      return
    }
    if (step === 1) {
      if (!subdomain) {
        setError('Укажите адрес (поддомен).')
        return
      }
      const ok = await save({ subdomain, step: 2 })
      if (ok) setStep(2)
      return
    }
    if (step === 2) {
      if (!category) {
        setError('Выберите категорию.')
        return
      }
      const ok = await save({ category, step: 3 })
      if (ok) setStep(3)
      return
    }
    if (step === 3) {
      const ok = await save({ step: 4 })
      if (ok) setStep(4)
      return
    }
    if (step === LAST) {
      const ok = await save({ complete: true })
      if (ok) {
        router.replace('/studio')
        router.refresh()
      }
    }
  }

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    setSaving(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/studio/api/settings/logo', {
        method: 'POST',
        credentials: 'include',
        body: fd,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Не удалось загрузить изображение.')
        return
      }
      setLogoUrl(data.url || null)
    } catch {
      setError('Сетевая ошибка при загрузке.')
    } finally {
      setSaving(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const catLabel = CATEGORIES.find((c) => c.value === category)?.label || '—'

  return (
    <div className="studio-login onb">

      <div className="studio-login__bg" aria-hidden>
        <span className="studio-login__grid" />
      </div>

      <div className="studio-login__card onb__card">
        <div className="onb__head">
          <div className="onb__eyebrow">Настройка · Контент Бокс</div>
          <div className="onb__progress">
            {STEPS.map((s, i) => (
              <span
                key={s}
                className={`onb__dot ${i === step ? 'is-active' : ''} ${i < step ? 'is-done' : ''}`}
                title={s}
              />
            ))}
          </div>
          <div className="onb__stepno">
            Шаг {step + 1} из {STEPS.length} · {STEPS[step]}
          </div>
        </div>

        <div className="onb__body">
          {step === 0 && (
            <>
              <h1 className="onb__title">Расскажите о проекте</h1>
              <p className="onb__lede">Название увидят ваши подписчики. Описание можно изменить позже.</p>
              <label className="studio-field">
                <span className="studio-field__label">Название проекта</span>
                <input
                  className="studio-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Мой фандом"
                  disabled={saving}
                  autoFocus
                />
              </label>
              <label className="studio-field">
                <span className="studio-field__label">Короткое описание</span>
                <textarea
                  className="studio-input onb__textarea"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="О чём ваш проект — в одном-двух предложениях"
                  rows={3}
                  disabled={saving}
                />
              </label>
            </>
          )}

          {step === 1 && (
            <>
              <h1 className="onb__title">Адрес вашего сайта</h1>
              <p className="onb__lede">Латиница, цифры и дефис. Позже можно подключить свой домен.</p>
              <label className="studio-field">
                <span className="studio-field__label">Поддомен</span>
                <div className="onb__addr">
                  <input
                    className="studio-input onb__addr-input"
                    value={subdomain}
                    onChange={(e) => setSubdomain(sanitizeSub(e.target.value))}
                    placeholder="my-fandom"
                    disabled={saving}
                    autoFocus
                  />
                  <span className="onb__addr-suffix">.contentbox.site</span>
                </div>
              </label>
              <div className="onb__preview">
                Ваш адрес: <b>{(subdomain || 'ваш-адрес')}.contentbox.site</b>
              </div>
              <p className="onb__subnote">
                Свой собственный домен можно будет подключить позже в личном кабинете.
                Домен третьего уровня <b>.contentbox.site</b> остаётся бесплатным и всегда
                доступен как резервный адрес.
              </p>
            </>
          )}

          {step === 2 && (
            <>
              <h1 className="onb__title">Категория проекта</h1>
              <p className="onb__lede">Поможет с оформлением и рекомендациями.</p>
              <div className="onb__radios" role="radiogroup" aria-label="Категория проекта">
                {CATEGORIES.map((c) => (
                  <label
                    key={c.value}
                    className={`onb__radio ${category === c.value ? 'is-active' : ''}`}
                  >
                    <input
                      type="radio"
                      name="category"
                      value={c.value}
                      checked={category === c.value}
                      onChange={() => setCategory(c.value)}
                      disabled={saving}
                    />
                    <span className="onb__radio-dot" aria-hidden />
                    <span className="onb__radio-label">{c.label}</span>
                  </label>
                ))}
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <h1 className="onb__title">Аватар или логотип</h1>
              <p className="onb__lede">Необязательно — можно пропустить и добавить позже.</p>
              <div className="onb__avatar">
                <div className="onb__avatar-preview">
                  {logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoUrl} alt="Логотип" />
                  ) : (
                    <span className="onb__avatar-empty">{(name || 'К').slice(0, 1).toUpperCase()}</span>
                  )}
                </div>
                <div className="onb__avatar-actions">
                  <button
                    type="button"
                    className="studio-btn"
                    onClick={() => fileRef.current?.click()}
                    disabled={saving}
                  >
                    {logoUrl ? 'Заменить' : 'Загрузить'}
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml,image/avif"
                    hidden
                    onChange={onPickFile}
                  />
                  <span className="onb__hint">PNG, JPG, WebP, SVG · до 6 МБ</span>
                </div>
              </div>
            </>
          )}

          {step === LAST && (
            <>
              <h1 className="onb__title">Всё готово</h1>
              <p className="onb__lede">Проверьте данные и открывайте студию.</p>
              <div className="onb__summary">
                <div className="onb__row"><span>Проект</span><b>{name || '—'}</b></div>
                <div className="onb__row"><span>Адрес</span><b>{(subdomain || '—')}{subdomain ? '.contentbox.site' : ''}</b></div>
                <div className="onb__row"><span>Категория</span><b>{catLabel}</b></div>
                <div className="onb__row"><span>Логотип</span><b>{logoUrl ? 'Загружен' : 'Не задан'}</b></div>
                <div className="onb__row"><span>Аккаунт</span><b>{email}</b></div>
              </div>
            </>
          )}

          {error && (
            <div className="studio-login__error" style={{ marginTop: 'var(--st-space-3)' }}>{error}</div>
          )}
        </div>

        <div className="onb__foot">
          {step > 0 ? (
            <button type="button" className="studio-btn" onClick={goBack} disabled={saving}>
              Назад
            </button>
          ) : (
            <span />
          )}
          <div className="onb__foot-right">
            {step === 3 && (
              <button type="button" className="studio-btn" onClick={next} disabled={saving}>
                Пропустить
              </button>
            )}
            <button type="button" className="studio-btn studio-btn--primary" onClick={next} disabled={saving}>
              {saving ? 'Сохраняем…' : step === LAST ? 'Открыть студию' : 'Далее'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
