'use client'

import React, { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ImagePlus, Loader2, Plus, Trash2, Check, Sun, Moon } from 'lucide-react'

type Social = { platform: string; url: string }
type Tier = {
  id: number | string
  name: string
  weight: number
  priceRub: number
  isActive: boolean
}

const PLATFORMS = [
  { value: 'boosty', label: 'Boosty' },
  { value: 'vk', label: 'VK' },
  { value: 'telegram', label: 'Telegram' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'instagram', label: 'Instagram' },
]

export function SettingsView({
  logoUrl,
  socials: initialSocials,
  tiers: initialTiers,
}: {
  logoUrl: string | null
  socials: Social[]
  tiers: Tier[]
}) {
  return (
    <>
      <div className="studio-page-head">
        <div>
          <h1>Настройки</h1>
          <div className="studio-page-head__sub">Оформление и подписки вашего сайта</div>
        </div>
      </div>

      <div className="settings">
        <ThemeBlock />
        <LogoBlock initialUrl={logoUrl} />
        <SocialsBlock initial={initialSocials} />
        <TiersBlock initial={initialTiers} />
      </div>
    </>
  )
}

/* -------------------------------------------------------------------------- */
/* Тема студии (клиентская, localStorage — как на фронтенде)                    */
/* -------------------------------------------------------------------------- */
function ThemeBlock() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('theme') : null
    setTheme(saved === 'light' ? 'light' : 'dark')
  }, [])

  function apply(next: 'dark' | 'light') {
    setTheme(next)
    try {
      localStorage.setItem('theme', next)
      const el = document.documentElement
      el.classList.remove('theme-dark', 'theme-light')
      el.classList.add('theme-' + next)
      el.style.colorScheme = next
    } catch {
      /* noop */
    }
  }

  return (
    <section className="settings__block">
      <div className="settings__block-head">
        <h2>Тема студии</h2>
        <p>Оформление этой панели. На публичный сайт не влияет.</p>
      </div>
      <div className="settings__theme">
        <button
          className={`settings__theme-opt${theme === 'dark' ? ' is-active' : ''}`}
          onClick={() => apply('dark')}
        >
          <Moon size={16} />
          Тёмная
        </button>
        <button
          className={`settings__theme-opt${theme === 'light' ? ' is-active' : ''}`}
          onClick={() => apply('light')}
        >
          <Sun size={16} />
          Светлая
        </button>
      </div>
    </section>
  )
}

/* -------------------------------------------------------------------------- */
/* Логотип                                                                     */
/* -------------------------------------------------------------------------- */
function LogoBlock({ initialUrl }: { initialUrl: string | null }) {
  const [url, setUrl] = useState<string | null>(initialUrl)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/studio/api/settings/logo', {
        method: 'POST',
        body: fd,
        credentials: 'include',
      })
      const json = await res.json()
      if (!res.ok) setError(json.error || 'Не удалось загрузить')
      else setUrl(json.url)
    } catch {
      setError('Ошибка загрузки')
    } finally {
      setUploading(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  return (
    <section className="settings__block">
      <div className="settings__block-head">
        <h2>Логотип</h2>
        <p>Отображается в шапке сайта.</p>
      </div>
      <div className="settings__logo">
        {url ? (
          <div className="settings__logo-preview">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="Логотип" />
          </div>
        ) : (
          <div className="settings__logo-empty">Нет логотипа</div>
        )}
        <div>
          <button
            className="studio-btn studio-btn--ghost"
            onClick={() => fileInput.current?.click()}
            disabled={uploading}
          >
            {uploading ? <Loader2 size={16} className="spin" /> : <ImagePlus size={16} />}
            {url ? 'Заменить' : 'Загрузить'}
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            onChange={handleFile}
            style={{ display: 'none' }}
          />
          {error && <div className="settings__err">{error}</div>}
        </div>
      </div>
    </section>
  )
}

/* -------------------------------------------------------------------------- */
/* Соцсети                                                                     */
/* -------------------------------------------------------------------------- */
function SocialsBlock({ initial }: { initial: Social[] }) {
  const [rows, setRows] = useState<Social[]>(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  function add() {
    setRows((r) => [...r, { platform: 'telegram', url: '' }])
    setSaved(false)
  }
  function remove(i: number) {
    setRows((r) => r.filter((_, idx) => idx !== i))
    setSaved(false)
  }
  function update(i: number, patch: Partial<Social>) {
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)))
    setSaved(false)
  }

  async function save() {
    setError(null)
    setSaved(false)
    // локальная проверка
    for (const r of rows) {
      if (!r.url.trim()) {
        setError('У каждой соцсети должна быть ссылка')
        return
      }
    }
    setSaving(true)
    try {
      const res = await fetch('/studio/api/settings/socials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ socials: rows }),
      })
      const json = await res.json()
      if (!res.ok) setError(json.error || 'Не удалось сохранить')
      else setSaved(true)
    } catch {
      setError('Ошибка соединения')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="settings__block">
      <div className="settings__block-head">
        <h2>Соцсети</h2>
        <p>Ссылки в шапке и футере сайта.</p>
      </div>

      <div className="settings__socials">
        {rows.length === 0 && (
          <div className="settings__hint">Пока не добавлено ни одной ссылки.</div>
        )}
        {rows.map((row, i) => (
          <div key={i} className="settings__social-row">
            <select
              className="studio-input settings__social-platform"
              value={row.platform}
              onChange={(e) => update(i, { platform: e.target.value })}
            >
              {PLATFORMS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
            <input
              className="studio-input"
              placeholder="https://…"
              value={row.url}
              onChange={(e) => update(i, { url: e.target.value })}
            />
            <button className="catmgr__icon-btn catmgr__icon-btn--danger" onClick={() => remove(i)} title="Удалить">
              <Trash2 size={15} />
            </button>
          </div>
        ))}

        <button className="studio-btn studio-btn--ghost settings__add" onClick={add}>
          <Plus size={16} />
          Добавить ссылку
        </button>

        {error && <div className="settings__err">{error}</div>}

        <div className="settings__save-row">
          {saved && <span className="settings__saved"><Check size={15} /> Сохранено</span>}
          <button className="studio-btn studio-btn--primary" onClick={save} disabled={saving}>
            {saving ? <Loader2 size={16} className="spin" /> : null}
            Сохранить соцсети
          </button>
        </div>
      </div>
    </section>
  )
}

/* -------------------------------------------------------------------------- */
/* Уровни подписки (только редактирование)                                     */
/* -------------------------------------------------------------------------- */
function TiersBlock({ initial }: { initial: Tier[] }) {
  const router = useRouter()
  const [tiers, setTiers] = useState<Tier[]>(initial)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [savedId, setSavedId] = useState<string | null>(null)

  function edit(id: string | number, patch: Partial<Tier>) {
    setTiers((ts) => ts.map((t) => (String(t.id) === String(id) ? { ...t, ...patch } : t)))
    setSavedId(null)
  }

  async function saveTier(t: Tier) {
    setError(null)
    setSavedId(null)
    setSavingId(String(t.id))
    try {
      const res = await fetch('/studio/api/settings/tier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          id: t.id,
          name: t.name,
          priceRub: t.priceRub,
          isActive: t.isActive,
        }),
      })
      const json = await res.json()
      if (!res.ok) setError(json.error || 'Не удалось сохранить')
      else {
        setSavedId(String(t.id))
        router.refresh()
      }
    } catch {
      setError('Ошибка соединения')
    } finally {
      setSavingId(null)
    }
  }

  return (
    <section className="settings__block">
      <div className="settings__block-head">
        <h2>Уровни подписки</h2>
        <p>Название, цена и активность. Иерархия (вес) меняется в админке.</p>
      </div>

      {tiers.length === 0 ? (
        <div className="settings__hint">Уровней подписки пока нет.</div>
      ) : (
        <div className="settings__tiers">
          {tiers.map((t) => (
            <div key={t.id} className="settings__tier">
              <input
                className="studio-input settings__tier-name"
                value={t.name}
                onChange={(e) => edit(t.id, { name: e.target.value })}
              />
              <div className="settings__tier-price">
                <input
                  className="studio-input"
                  type="number"
                  min={0}
                  value={t.priceRub}
                  onChange={(e) => edit(t.id, { priceRub: Number(e.target.value) })}
                />
                <span className="settings__tier-rub">₽/мес</span>
              </div>
              <label className="settings__tier-active">
                <input
                  type="checkbox"
                  checked={t.isActive}
                  onChange={(e) => edit(t.id, { isActive: e.target.checked })}
                />
                Активен
              </label>
              <button
                className="studio-btn studio-btn--ghost settings__tier-save"
                onClick={() => saveTier(t)}
                disabled={savingId === String(t.id)}
              >
                {savingId === String(t.id) ? (
                  <Loader2 size={15} className="spin" />
                ) : savedId === String(t.id) ? (
                  <Check size={15} />
                ) : null}
                Сохранить
              </button>
            </div>
          ))}
        </div>
      )}

      {error && <div className="settings__err">{error}</div>}
    </section>
  )
}
