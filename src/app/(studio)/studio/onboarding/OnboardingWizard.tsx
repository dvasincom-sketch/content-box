'use client'

import React, { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Пошаговый мастер онбординга (возобновляемый). Каждый «Далее» сохраняет поля
 * шага на tenant и двигает onboardingStep, поэтому при возврате мастер
 * открывается на том же месте. Финал ставит onboardingComplete=true → студия.
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
    <div className="onb">
      <style>{ONB_CSS}</style>

      <div className="onb__bg" aria-hidden>
        <span className="onb__grid" />
      </div>

      <div className="onb__card">
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
              <label className="onb__field">
                <span className="onb__label">Название проекта</span>
                <input
                  className="onb__input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Мой фандом"
                  disabled={saving}
                  autoFocus
                />
              </label>
              <label className="onb__field">
                <span className="onb__label">Короткое описание</span>
                <textarea
                  className="onb__input onb__textarea"
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
              <label className="onb__field">
                <span className="onb__label">Поддомен</span>
                <div className="onb__addr">
                  <input
                    className="onb__input onb__addr-input"
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
            </>
          )}

          {step === 2 && (
            <>
              <h1 className="onb__title">Категория проекта</h1>
              <p className="onb__lede">Поможет с оформлением и рекомендациями.</p>
              <div className="onb__cats">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    className={`onb__cat ${category === c.value ? 'is-active' : ''}`}
                    onClick={() => setCategory(c.value)}
                    disabled={saving}
                  >
                    {c.label}
                  </button>
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
                    className="onb__btn onb__btn--ghost"
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

          {error && <div className="onb__error">{error}</div>}
        </div>

        <div className="onb__foot">
          {step > 0 ? (
            <button type="button" className="onb__btn onb__btn--ghost" onClick={goBack} disabled={saving}>
              Назад
            </button>
          ) : (
            <span />
          )}
          <div className="onb__foot-right">
            {step === 3 && (
              <button type="button" className="onb__btn onb__btn--ghost" onClick={next} disabled={saving}>
                Пропустить
              </button>
            )}
            <button type="button" className="onb__btn onb__btn--primary" onClick={next} disabled={saving}>
              {saving ? 'Сохраняем…' : step === LAST ? 'Открыть студию' : 'Далее'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

const ONB_CSS = `
.onb {
  position:relative; min-height:100vh; display:flex; align-items:center; justify-content:center;
  padding:40px 20px; background:var(--st-bg); color:var(--st-text);
  font-family:var(--font-sans, 'IBM Plex Sans', system-ui, sans-serif);
}
.onb__bg { position:fixed; inset:0; z-index:0; overflow:hidden; pointer-events:none; }
.onb__grid {
  position:absolute; inset:0; opacity:.5;
  background-image:
    linear-gradient(to right, rgba(255,255,255,.03) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(255,255,255,.03) 1px, transparent 1px);
  background-size:44px 44px;
  mask-image:radial-gradient(circle at 50% 35%, #000 30%, transparent 72%);
}
.onb__card {
  position:relative; z-index:1; width:100%; max-width:520px;
  background:var(--st-surface); border:1px solid var(--st-border);
  border-radius:16px; box-shadow:var(--st-shadow); padding:28px 28px 22px;
}
.onb__head { margin-bottom:20px; }
.onb__eyebrow {
  font-family:var(--font-mono, 'IBM Plex Mono', monospace);
  font-size:12px; letter-spacing:.12em; color:var(--st-text-muted); margin-bottom:14px;
}
.onb__progress { display:flex; gap:8px; margin-bottom:10px; }
.onb__dot { width:26px; height:4px; border-radius:2px; background:var(--st-surface-hover); transition:background .2s ease; }
.onb__dot.is-active { background:var(--st-accent); }
.onb__dot.is-done { background:color-mix(in srgb, var(--st-accent) 55%, transparent); }
.onb__stepno {
  font-family:var(--font-mono, monospace); font-size:12px; color:var(--st-text-faint);
}
.onb__body { min-height:220px; }
.onb__title { font-size:24px; font-weight:600; letter-spacing:-.02em; margin:0 0 6px; }
.onb__lede { font-size:14px; color:var(--st-text-muted); margin:0 0 18px; line-height:1.5; }
.onb__field { display:flex; flex-direction:column; gap:6px; margin-bottom:14px; }
.onb__label { font-family:var(--font-mono, monospace); font-size:12px; color:var(--st-text-muted); }
.onb__input {
  width:100%; padding:11px 13px; font-size:15px;
  font-family:var(--font-sans, system-ui, sans-serif);
  color:var(--st-text); background:var(--st-surface-2);
  border:1px solid var(--st-border); border-radius:9px; outline:none;
  transition:border-color .15s ease;
}
.onb__input:focus { border-color:var(--st-border-strong); }
.onb__input::placeholder { color:var(--st-text-faint); }
.onb__textarea { resize:vertical; line-height:1.5; }
.onb__addr { display:flex; align-items:stretch; }
.onb__addr-input { border-top-right-radius:0; border-bottom-right-radius:0; }
.onb__addr-suffix {
  display:flex; align-items:center; padding:0 12px; font-size:14px; color:var(--st-text-muted);
  background:var(--st-surface-hover); border:1px solid var(--st-border); border-left:none;
  border-top-right-radius:9px; border-bottom-right-radius:9px; white-space:nowrap;
}
.onb__preview { font-size:13px; color:var(--st-text-muted); }
.onb__preview b { color:var(--st-text); }
.onb__cats { display:grid; grid-template-columns:repeat(2, 1fr); gap:10px; }
.onb__cat {
  padding:13px 14px; font-size:14px; text-align:left; cursor:pointer;
  color:var(--st-text); background:var(--st-surface-2);
  border:1px solid var(--st-border); border-radius:10px; transition:border-color .15s ease, background .15s ease;
}
.onb__cat:hover { background:var(--st-surface-hover); }
.onb__cat.is-active { border-color:var(--st-accent); background:var(--st-surface-hover); }
.onb__avatar { display:flex; align-items:center; gap:18px; }
.onb__avatar-preview {
  width:88px; height:88px; border-radius:16px; overflow:hidden; flex:none;
  background:var(--st-surface-2); border:1px solid var(--st-border);
  display:flex; align-items:center; justify-content:center;
}
.onb__avatar-preview img { width:100%; height:100%; object-fit:cover; }
.onb__avatar-empty { font-size:34px; font-weight:600; color:var(--st-text-faint); }
.onb__avatar-actions { display:flex; flex-direction:column; gap:8px; align-items:flex-start; }
.onb__hint { font-size:12px; color:var(--st-text-faint); }
.onb__summary { display:flex; flex-direction:column; gap:2px; }
.onb__row {
  display:flex; justify-content:space-between; gap:16px; padding:11px 0;
  border-bottom:1px solid var(--st-border); font-size:14px;
}
.onb__row:last-child { border-bottom:none; }
.onb__row span { color:var(--st-text-muted); }
.onb__row b { color:var(--st-text); font-weight:500; text-align:right; word-break:break-word; }
.onb__error {
  margin-top:16px; font-size:14px; color:var(--st-danger);
  background:color-mix(in srgb, var(--st-danger) 12%, transparent);
  border:1px solid color-mix(in srgb, var(--st-danger) 30%, transparent);
  border-radius:9px; padding:10px 12px;
}
.onb__foot {
  display:flex; align-items:center; justify-content:space-between; gap:12px;
  margin-top:22px; padding-top:18px; border-top:1px solid var(--st-border);
}
.onb__foot-right { display:flex; gap:10px; }
.onb__btn {
  padding:11px 18px; font-size:14px; font-weight:600; border-radius:9px; cursor:pointer;
  font-family:var(--font-sans, system-ui, sans-serif); border:1px solid transparent;
  transition:background .15s ease, border-color .15s ease;
}
.onb__btn:disabled { opacity:.6; cursor:default; }
.onb__btn--primary { background:var(--st-accent); color:var(--st-accent-text); }
.onb__btn--primary:hover:not(:disabled) { background:var(--st-accent-hover); }
.onb__btn--ghost { background:transparent; color:var(--st-text); border-color:var(--st-border); }
.onb__btn--ghost:hover:not(:disabled) { background:var(--st-surface-hover); }
@media (max-width:520px){
  .onb__card { padding:22px 18px; }
  .onb__cats { grid-template-columns:1fr; }
}
`
