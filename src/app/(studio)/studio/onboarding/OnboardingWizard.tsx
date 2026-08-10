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
  archetype: string
  step: number
  logoUrl: string | null
}

const STEPS = ['Бренд', 'Адрес', 'Что создаёте', 'Аватар', 'Готово']
const LAST = STEPS.length - 1

// Архетип задаёт оформление (тема-пресет) и подсказки. Курсы — пока «Скоро».
const ARCHETYPES: { value: string; label: string; desc: string; soon?: boolean }[] = [
  { value: 'writer', label: 'Автор книг', desc: 'Книги и главы, ридер' },
  { value: 'video', label: 'Видео и озвучка', desc: 'Своё видео, плейлисты, субтитры' },
  { value: 'course', label: 'Курсы', desc: 'Уроки и прогресс прохождения', soon: true },
  { value: 'podcast', label: 'Подкасты и аудио', desc: 'Аудио-раздел и фонотека' },
  { value: 'expert', label: 'Эксперт и наставник', desc: 'Статьи, видео и сообщество' },
  { value: 'studio', label: 'Медиа-студия', desc: 'Всё сразу — большой архив' },
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
  const [archetype, setArchetype] = useState(initial.archetype)
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
      if (!archetype) {
        setError('Выберите, что вы создаёте.')
        return
      }
      const ok = await save({ archetype, step: 3 })
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
              <h1 className="onb__title">Что вы создаёте?</h1>
              <p className="onb__lede">Подберём оформление и подскажем, с чего начать. Всё можно поменять потом.</p>
              <div className="onb__radios" role="radiogroup" aria-label="Что вы создаёте">
                {ARCHETYPES.map((a) => (
                  <label
                    key={a.value}
                    className={`onb__radio ${archetype === a.value ? 'is-active' : ''}`}
                    style={a.soon ? { opacity: 0.55, cursor: 'not-allowed' } : undefined}
                    title={a.soon ? 'Скоро' : undefined}
                  >
                    <input
                      type="radio"
                      name="archetype"
                      value={a.value}
                      checked={archetype === a.value}
                      onChange={() => { if (!a.soon) setArchetype(a.value) }}
                      disabled={saving || a.soon}
                    />
                    <span className="onb__radio-dot" aria-hidden />
                    <span className="onb__radio-label">
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                        {a.label}
                        {a.soon && (
                          <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 8px', borderRadius: 999, background: 'var(--st-surface-2, rgba(128,128,128,.16))', color: 'var(--st-text-muted, #8a8a8a)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Скоро</span>
                        )}
                      </span>
                      <span style={{ display: 'block', fontSize: 12.5, opacity: 0.7, fontWeight: 400, marginTop: 2 }}>{a.desc}</span>
                    </span>
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
