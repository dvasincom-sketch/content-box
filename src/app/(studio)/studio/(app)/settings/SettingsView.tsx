'use client'

import React, { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ImagePlus, Loader2, Plus, Trash2, Check, Sun, Moon, ChevronDown, GripVertical } from 'lucide-react'
import { PerkIcon, PERK_TYPES, type PerkType } from '@/components/studio/PerkIcon'
import { StudioSelect } from '../_ui/StudioSelect'
import { MenuBuilder } from './MenuBuilder'

type Social = { platform: string; url: string }
type Perk = { type: PerkType; text: string }
type Tier = {
  id: number | string
  name: string
  slug: string
  weight: number
  priceRub: number
  description: string
  isActive: boolean
  perks: Perk[]
}

type SettingsTab = 'appearance' | 'socials' | 'menu' | 'tiers'

const TABS: { id: SettingsTab; label: string }[] = [
  { id: 'appearance', label: 'Оформление' },
  { id: 'socials', label: 'Соцсети' },
  { id: 'menu', label: 'Меню и футер' },
  { id: 'tiers', label: 'Подписки' },
]

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
  const [tab, setTab] = useState<SettingsTab>('appearance')

  return (
    <>
      <div className="studio-page-head">
        <div>
          <h1>Настройки</h1>
          <div className="studio-page-head__sub">Оформление и подписки вашего сайта</div>
        </div>
      </div>

      <div className="settings__tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`settings__tab${tab === t.id ? ' is-active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="settings">
        {tab === 'appearance' && (
          <>
            <ThemeBlock />
            <LogoBlock initialUrl={logoUrl} />
          </>
        )}
        {tab === 'socials' && <SocialsBlock initial={initialSocials} />}
        {tab === 'menu' && <MenuBlock />}
        {tab === 'tiers' && <TiersBlock initial={initialTiers} />}
      </div>
    </>
  )
}

/* -------------------------------------------------------------------------- */
/* Управление меню и футером                                                   */
/* -------------------------------------------------------------------------- */
function MenuBlock() {
  return (
    <section className="settings__block">
      <div className="settings__block-head">
        <h2>Меню и футер</h2>
        <p>Порядок и видимость пунктов навигации. Категории подтягиваются автоматически — лишние можно скрыть.</p>
      </div>
      <div className="menubld-section">
        <MenuBuilder />
      </div>
    </section>
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
            <StudioSelect
              className="settings__social-platform"
              value={row.platform}
              onChange={(v) => update(i, { platform: v })}
              options={PLATFORMS.map((p) => ({ value: p.value, label: p.label }))}
              ariaLabel="Платформа"
            />
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
  const [openId, setOpenId] = useState<string | number | null>(null)
  const [creating, setCreating] = useState(false)

  function refresh() {
    router.refresh()
  }

  return (
    <section className="settings__card">
      <div className="settings__card-head">
        <h2>Подписки</h2>
        <button
          className="studio-btn studio-btn--ghost settings__add-tier"
          onClick={() => {
            setCreating((v) => !v)
            setOpenId(null)
          }}
        >
          <Plus size={16} /> Новый уровень
        </button>
      </div>

      {creating && (
        <TierEditor
          mode="create"
          onSaved={() => {
            setCreating(false)
            refresh()
          }}
          onCancel={() => setCreating(false)}
        />
      )}

      {tiers.length === 0 && !creating ? (
        <p className="settings__hint">Уровней пока нет. Создайте первый — например, РАМЁН.</p>
      ) : (
        <div className="settings__tiers-list">
          {tiers.map((t) => (
            <div key={t.id} className="settings__tier-row">
              <button
                className="settings__tier-summary"
                onClick={() => setOpenId(openId === t.id ? null : t.id)}
              >
                <ChevronDown
                  size={16}
                  className={openId === t.id ? 'settings__tier-chev is-open' : 'settings__tier-chev'}
                />
                <span className="settings__tier-name-txt">{t.name}</span>
                <span className="settings__tier-weight">вес {t.weight}</span>
                <span className="settings__tier-price-txt">{t.priceRub} ₽/мес</span>
                {!t.isActive && <span className="settings__tier-off">выкл</span>}
                {t.perks?.length > 0 && (
                  <span className="settings__tier-perks-count">{t.perks.length} плюшек</span>
                )}
              </button>
              {openId === t.id && (
                <TierEditor
                  mode="edit"
                  tier={t}
                  onSaved={refresh}
                  onCancel={() => setOpenId(null)}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

/* Редактор одного тарифа: создание или редактирование */
function TierEditor({
  mode,
  tier,
  onSaved,
  onCancel,
}: {
  mode: 'create' | 'edit'
  tier?: Tier
  onSaved: () => void
  onCancel: () => void
}) {
  const [name, setName] = useState(tier?.name || '')
  const [slug, setSlug] = useState(tier?.slug || '')
  const [weight, setWeight] = useState(String(tier?.weight ?? ''))
  const [priceRub, setPriceRub] = useState(String(tier?.priceRub ?? ''))
  const [description, setDescription] = useState(tier?.description || '')
  const [isActive, setIsActive] = useState(tier?.isActive ?? true)
  const [perks, setPerks] = useState<Perk[]>(tier?.perks || [])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function addPerk() {
    setPerks((p) => [...p, { type: 'included', text: '' }])
  }
  function editPerk(i: number, patch: Partial<Perk>) {
    setPerks((p) => p.map((perk, idx) => (idx === i ? { ...perk, ...patch } : perk)))
  }
  function removePerk(i: number) {
    setPerks((p) => p.filter((_, idx) => idx !== i))
  }
  function movePerk(i: number, dir: -1 | 1) {
    setPerks((p) => {
      const next = [...p]
      const j = i + dir
      if (j < 0 || j >= next.length) return p
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
  }

  async function save() {
    setError(null)
    if (!name.trim()) return setError('Укажите название')
    if (weight === '' || Number.isNaN(Number(weight))) return setError('Укажите вес (число)')
    if (priceRub === '' || Number.isNaN(Number(priceRub))) return setError('Укажите цену (число)')

    const cleanPerks = perks.filter((p) => p.text.trim())

    setBusy(true)
    try {
      const url = mode === 'create' ? '/studio/api/settings/tier-create' : '/studio/api/settings/tier'
      const body: any = {
        name: name.trim(),
        slug: slug.trim(),
        weight: Number(weight),
        priceRub: Number(priceRub),
        description,
        isActive,
        perks: cleanPerks,
      }
      if (mode === 'edit') body.id = tier!.id

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || 'Не удалось сохранить')
        setBusy(false)
        return
      }
      onSaved()
    } catch {
      setError('Ошибка соединения')
      setBusy(false)
    }
  }

  async function remove() {
    if (!tier) return
    if (!window.confirm(`Удалить уровень «${tier.name}»?`)) return
    setBusy(true)
    try {
      const res = await fetch('/studio/api/settings/tier-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id: tier.id }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || 'Не удалось удалить')
        setBusy(false)
        return
      }
      onSaved()
    } catch {
      setError('Ошибка соединения')
      setBusy(false)
    }
  }

  return (
    <div className="tier-editor">
      <div className="tier-editor__grid">
        <label className="studio-field">
          <span className="studio-field__label">Название</span>
          <input className="studio-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="РАМЁН" />
        </label>
        <label className="studio-field">
          <span className="studio-field__label">Slug (латиницей)</span>
          <input className="studio-input" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="ramyeon" />
        </label>
        <label className="studio-field">
          <span className="studio-field__label">Вес (иерархия)</span>
          <input className="studio-input" type="number" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="10" />
        </label>
        <label className="studio-field">
          <span className="studio-field__label">Цена, ₽/мес</span>
          <input className="studio-input" type="number" value={priceRub} onChange={(e) => setPriceRub(e.target.value)} placeholder="350" />
        </label>
      </div>

      <label className="studio-field">
        <span className="studio-field__label">Краткое описание</span>
        <textarea
          className="studio-input tier-editor__desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          placeholder="Короткое описание уровня для витрины."
        />
      </label>

      {/* Плюшки */}
      <div className="tier-editor__perks">
        <div className="tier-editor__perks-head">
          <span className="studio-field__label">Что входит (плюшки)</span>
          <button className="studio-btn studio-btn--ghost tier-editor__perk-add" onClick={addPerk}>
            <Plus size={14} /> Добавить
          </button>
        </div>

        {perks.length === 0 ? (
          <p className="settings__hint">Плюшек нет. Добавьте — например, «Доступ ко всему архиву».</p>
        ) : (
          <div className="tier-editor__perk-list">
            {perks.map((perk, i) => (
              <div key={i} className="tier-editor__perk">
                <div className="tier-editor__perk-move">
                  <button onClick={() => movePerk(i, -1)} disabled={i === 0} title="Выше">↑</button>
                  <button onClick={() => movePerk(i, 1)} disabled={i === perks.length - 1} title="Ниже">↓</button>
                </div>
                <div className="tier-editor__perk-type">
                  <span className="tier-editor__perk-icon"><PerkIcon type={perk.type} size={16} /></span>
                  <StudioSelect
                    value={perk.type}
                    onChange={(v) => editPerk(i, { type: v as PerkType })}
                    options={PERK_TYPES.map((pt) => ({ value: pt.value, label: pt.label }))}
                    ariaLabel="Тип преимущества"
                  />
                </div>
                <input
                  className="studio-input tier-editor__perk-text"
                  value={perk.text}
                  onChange={(e) => editPerk(i, { text: e.target.value })}
                  placeholder="Текст преимущества"
                />
                <button className="catmgr__icon-btn catmgr__icon-btn--danger" onClick={() => removePerk(i)} title="Убрать">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <label className="settings__tier-active">
        <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
        Активен (показывается для оформления)
      </label>

      {error && <div className="studio-login__error">{error}</div>}

      <div className="tier-editor__actions">
        {mode === 'edit' && (
          <button className="studio-btn studio-btn--ghost tier-editor__delete" onClick={remove} disabled={busy}>
            <Trash2 size={15} /> Удалить
          </button>
        )}
        <div className="tier-editor__actions-right">
          <button className="studio-btn studio-btn--ghost" onClick={onCancel}>Отмена</button>
          <button className="studio-btn studio-btn--primary" onClick={save} disabled={busy}>
            {busy ? <Loader2 size={16} className="spin" /> : <Check size={16} />}
            {mode === 'create' ? 'Создать' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  )
}
