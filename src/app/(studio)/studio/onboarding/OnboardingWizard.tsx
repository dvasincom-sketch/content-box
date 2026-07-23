'use client'

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
      <style>{ONB_CSS}</style>

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

const ONB_CSS = `
/* Онбординг живёт в шелле студийного логина: карточку прижимаем к верху
   (чтобы не «прыгала» между шагами) и делаем шире стандартного логина. */
.studio-login.onb { align-items: start; padding-top: var(--st-space-8); }
.onb__card { max-width: 560px; }
.onb .studio-field { margin-bottom: var(--st-space-4); }
.onb__textarea { min-height: 92px; resize: vertical; line-height: 1.5; }

.onb__head { margin-bottom: var(--st-space-5); }
.onb__eyebrow { font-family: var(--st-font-mono); font-size: 12px; letter-spacing: .12em; color: var(--st-text-muted); margin-bottom: 14px; }
.onb__progress { display: flex; gap: 8px; margin-bottom: 10px; }
.onb__dot { width: 26px; height: 4px; border-radius: 2px; background: var(--st-surface-hover); transition: background .2s ease; }
.onb__dot.is-active { background: var(--st-accent); }
.onb__dot.is-done { background: color-mix(in srgb, var(--st-accent) 55%, transparent); }
.onb__stepno { font-family: var(--st-font-mono); font-size: 12px; color: var(--st-text-faint); }
.onb__body { min-height: 220px; }
.onb__title { font-size: var(--st-text-xl); font-weight: 600; letter-spacing: -.02em; margin: 0 0 6px; }
.onb__lede { font-size: var(--st-text-sm); color: var(--st-text-muted); margin: 0 0 18px; line-height: 1.5; }

.onb__addr { display: flex; align-items: stretch; }
.onb__addr .onb__addr-input { border-top-right-radius: 0; border-bottom-right-radius: 0; }
.onb__addr-suffix {
  display: flex; align-items: center; padding: 0 12px; font-size: 14px; color: var(--st-text-muted);
  background: var(--st-surface-hover); border: 1px solid var(--st-border); border-left: none;
  border-top-right-radius: var(--st-radius-sm); border-bottom-right-radius: var(--st-radius-sm); white-space: nowrap;
}
.onb__preview { font-size: 13px; color: var(--st-text-muted); }
.onb__preview b { color: var(--st-text); }
.onb__subnote { margin-top: 12px; font-size: 12.5px; line-height: 1.5; color: var(--st-text-faint); }
.onb__subnote b { color: var(--st-text-muted); font-weight: 500; }

.onb__radios { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
.onb__radio {
  display: flex; align-items: center; gap: 11px; padding: 12px 14px; cursor: pointer;
  background: var(--st-surface-2); border: 1px solid var(--st-border); border-radius: var(--st-radius-sm);
  transition: border-color .15s ease, background .15s ease;
}
.onb__radio:hover { background: var(--st-surface-hover); }
.onb__radio.is-active { border-color: var(--st-accent); background: var(--st-surface-hover); }
.onb__radio input { position: absolute; opacity: 0; width: 0; height: 0; }
.onb__radio-dot { flex: none; width: 18px; height: 18px; border-radius: 50%; border: 2px solid var(--st-border-strong); background: transparent; transition: border-color .15s ease; position: relative; }
.onb__radio.is-active .onb__radio-dot { border-color: var(--st-accent); }
.onb__radio.is-active .onb__radio-dot::after { content: ''; position: absolute; inset: 3px; border-radius: 50%; background: var(--st-accent); }
.onb__radio input:focus-visible + .onb__radio-dot { box-shadow: 0 0 0 3px color-mix(in srgb, var(--st-accent) 30%, transparent); }
.onb__radio-label { font-size: 14px; color: var(--st-text); }

.onb__avatar { display: flex; align-items: center; gap: 18px; }
.onb__avatar-preview { width: 88px; height: 88px; border-radius: 16px; overflow: hidden; flex: none; background: var(--st-surface-2); border: 1px solid var(--st-border); display: flex; align-items: center; justify-content: center; }
.onb__avatar-preview img { width: 100%; height: 100%; object-fit: cover; }
.onb__avatar-empty { font-size: 34px; font-weight: 600; color: var(--st-text-faint); }
.onb__avatar-actions { display: flex; flex-direction: column; gap: 8px; align-items: flex-start; }
.onb__hint { font-size: 12px; color: var(--st-text-faint); }

.onb__summary { display: flex; flex-direction: column; gap: 2px; }
.onb__row { display: flex; justify-content: space-between; gap: 16px; padding: 11px 0; border-bottom: 1px solid var(--st-border); font-size: 14px; }
.onb__row:last-child { border-bottom: none; }
.onb__row span { color: var(--st-text-muted); }
.onb__row b { color: var(--st-text); font-weight: 500; text-align: right; word-break: break-word; }

.onb__foot { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 22px; padding-top: 18px; border-top: 1px solid var(--st-border); }
.onb__foot-right { display: flex; gap: 10px; }
@media (max-width: 560px) {
  .onb__radios { grid-template-columns: 1fr; }
}
`
