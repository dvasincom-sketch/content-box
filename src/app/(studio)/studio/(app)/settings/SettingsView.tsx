'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Plus, Trash2, Check, ChevronDown } from 'lucide-react'
import { PerkIcon, PERK_TYPES, type PerkType } from '@/components/studio/PerkIcon'
import { StudioSelect } from '../_ui/StudioSelect'
import { MenuBuilder } from './MenuBuilder'
import { PagesPanel } from './PagesPanel'
import { HomeBuilder } from './HomeBuilder'
import { TemplatesPanel } from './TemplatesPanel'
import { ImageUploadField } from './ImageUploadField'
import { BgDecorPicker } from './BgDecorPicker'
import { ThemeLibrary } from './ThemeLibrary'
import { GoalsPanel, type Goal } from './GoalsPanel'
import { DonatePresetsPanel, type DonatePreset } from './DonatePresetsPanel'
import { YookassaPanel } from './YookassaPanel'
import { hasCap, type CapMatrix } from '@/lib/permissions'
import { type HomeSavedTemplate } from '@/lib/homePacks'
import type { HomeSectionConfig } from '@/lib/homeSections'
import { AccessPanel } from './AccessPanel'
import { type TariffPanelData } from './TariffPanel'
import { CostsPanel } from './CostsPanel'
import type { AiBilling } from '@/lib/aiUsageStats'

type Perk = { type: PerkType; text: string }
type Tier = {
  id: number | string
  name: string
  slug: string
  weight: number
  priceRub: number
  description: string
  isActive: boolean
  badge: string
  perks: Perk[]
}

type SettingsTab = 'appearance' | 'home' | 'menu' | 'tiers' | 'access' | 'tariff'
export type Member = { id: number | string; email: string; name: string; status: string; isSelf: boolean; studioRole?: string | null; capabilities?: import('@/lib/permissions').CapMatrix | null }

const TABS: { id: SettingsTab; label: string }[] = [
  { id: 'appearance', label: 'Оформление' },
  { id: 'home', label: 'Главная страница' },
  { id: 'menu', label: 'Меню и футер' },
  { id: 'tiers', label: 'Монетизация' },
  { id: 'access', label: 'Доступ' },
  { id: 'tariff', label: 'Тариф' },
]

export function SettingsView({
  logoUrl,
  tiers: initialTiers,
  homeSections,
  appIconUrl,
  ogImageUrl,
  savedTemplates,
  appliedTemplate,
  bgDecor,
  customThemes,
  themeSource,
  activeCustomThemeId,
  goals,
  donatePresets,
  members,
  isOwner,
  abilities,
  tariff,
  aiBilling,
}: {
  logoUrl: string | null
  appIconUrl: string | null
  ogImageUrl: string | null
  tiers: Tier[]
  homeSections: HomeSectionConfig[]
  savedTemplates: HomeSavedTemplate[]
  appliedTemplate: string | null
  bgDecor: string | null
  customThemes: { id: number; name: string; theme: any }[]
  themeSource: 'preset' | 'custom'
  activeCustomThemeId: number | null
  goals: Goal[]
  donatePresets: DonatePreset[]
  members: Member[]
  isOwner: boolean
  abilities: CapMatrix | null
  tariff: TariffPanelData | null
  aiBilling: AiBilling
}) {
  const canTab = (id: SettingsTab): boolean => {
    if (isOwner) return true
    switch (id) {
      case 'appearance': return hasCap(abilities, 'appearance', 'manage') || hasCap(abilities, 'authorShowcase', 'manage')
      case 'home': return hasCap(abilities, 'home', 'manage')
      case 'menu': return hasCap(abilities, 'menu', 'manage')
      case 'tiers': return hasCap(abilities, 'tiers', 'manage') || hasCap(abilities, 'goals', 'manage')
      case 'access': return false
      case 'tariff': return false
      default: return false
    }
  }
  const visibleTabs = TABS.filter((t) => canTab(t.id))
  const [tab, setTab] = useState<SettingsTab>(visibleTabs[0]?.id ?? 'appearance')
  // Уникальная ссылка на подраздел через хэш (#menu и т.п.): читаем при входе,
  // пишем при переключении — чтобы можно было делиться ссылкой и вернуться на
  // тот же подраздел.
  useEffect(() => {
    const h = (typeof window !== 'undefined' ? window.location.hash.replace('#', '') : '') as SettingsTab
    if (h && visibleTabs.some((t) => t.id === h)) setTab(h)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  function selectTab(id: SettingsTab) {
    setTab(id)
    if (typeof window !== 'undefined') window.history.replaceState(null, '', `#${id}`)
  }

  // Панельная гранулярность вкладки «Оформление»: шаблоны меняют И тему, И
  // секции — поэтому требуют оба права (appearance+home); изображения/декор —
  // appearance; счётчики автора — authorShowcase.
  const canAppearance = isOwner || hasCap(abilities, 'appearance', 'manage')
  const canHome = isOwner || hasCap(abilities, 'home', 'manage')
  const canTemplates = canAppearance && canHome

  return (
    <>
      <div className="studio-page-head">
        <div>
          <h1>Настройки</h1>
          <div className="studio-page-head__sub">Оформление и подписки вашего сайта</div>
        </div>
      </div>

      {visibleTabs.length > 1 && (
      <div className="settings__tabs">
        {visibleTabs.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`settings__tab${tab === t.id ? ' is-active' : ''}`}
            onClick={() => selectTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      )}

      <div className="settings">
        {tab === 'appearance' && (
          <>
            {canTemplates && <TemplatesBlock savedTemplates={savedTemplates} appliedTemplate={appliedTemplate} />}
            {canAppearance && (
            <section className="settings__block">
              <div className="settings__block-head">
                <h2>Изображения</h2>
                <p>Логотип, иконка приложения и превью для соцсетей.</p>
              </div>
              <div className="imgfield-list">
                <ImageUploadField field="logo" title="Логотип" hint="Отображается в шапке сайта." initialUrl={logoUrl} compact />
                <ImageUploadField field="appIcon" title="Иконка приложения" hint="Квадрат ≥512×512. Из неё — favicon, apple-touch и иконка при установке PWA." initialUrl={appIconUrl} square compact />
                <ImageUploadField field="ogImage" title="Картинка для соцсетей (OG)" hint="Рекомендуется 1200×630. Показывается при отправке ссылки в мессенджерах." initialUrl={ogImageUrl} compact />
              </div>
            </section>
            )}
            {canAppearance && <BgDecorPicker initial={bgDecor} />}
            {canAppearance && (
              <ThemeLibrary
                initialThemes={customThemes}
                initialSource={themeSource}
                initialActiveId={activeCustomThemeId}
              />
            )}
          </>
        )}
        {tab === 'home' && <HomeBlock homeSections={homeSections} />}
        {tab === 'menu' && <MenuBlock />}
        {tab === 'menu' && <PagesBlock />}
        {tab === 'tiers' && (
          <>
            <TiersBlock initial={initialTiers} />
            <GoalsPanel initial={goals} />
            <DonatePresetsPanel initial={donatePresets} />
            {isOwner && <YookassaPanel />}
          </>
        )}
        {tab === 'access' && isOwner && <AccessPanel members={members} />}
        {tab === 'tariff' && isOwner && <CostsPanel tariff={tariff} ai={aiBilling} />}
      </div>
    </>
  )
}

/* -------------------------------------------------------------------------- */
/* Конструктор главной страницы                                                */
/* -------------------------------------------------------------------------- */
function HomeBlock({ homeSections }: { homeSections: HomeSectionConfig[] }) {
  return (
    <section className="settings__block">
      <div className="settings__block-head">
        <h2>Главная страница</h2>
        <p>Порядок и видимость секций главной. Перетаскивайте, чтобы поменять порядок, тумблером включайте или выключайте секции.</p>
      </div>
      <HomeBuilder initial={homeSections} />
    </section>
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
/* Страницы проекта — список и создание                                        */
/* -------------------------------------------------------------------------- */
function PagesBlock() {
  return (
    <section className="settings__block">
      <div className="settings__block-head">
        <h2>Страницы</h2>
        <p>Отдельные страницы проекта (например, «О проекте», FAQ, правила). Создайте страницу, наполните содержимым, а затем добавьте её в меню.</p>
      </div>
      <div className="menubld-section">
        <PagesPanel />
      </div>
    </section>
  )
}

/* -------------------------------------------------------------------------- */
/* Тема сайта — выбор готового пресета (палитра свет+тьма + шрифты)             */
/* -------------------------------------------------------------------------- */
function TemplatesBlock({ savedTemplates, appliedTemplate }: { savedTemplates: HomeSavedTemplate[]; appliedTemplate: string | null }) {
  return (
    <section className="settings__block">
      <div className="settings__block-head">
        <h2>Шаблоны</h2>
        <p>Готовые преднастройки под нишу: тема + набор и порядок секций + стартовые тексты. Откройте шаблон, при желании смените тему и примените. Свою главную можно сохранить как шаблон.</p>
      </div>
      <TemplatesPanel savedTemplates={savedTemplates} appliedTemplate={appliedTemplate} />
    </section>
  )
}

/* -------------------------------------------------------------------------- */
/* Логотип                                                                     */


/* -------------------------------------------------------------------------- */
/* Уровни подписки (только редактирование)                                     */
/* -------------------------------------------------------------------------- */
function TiersBlock({ initial }: { initial: Tier[] }) {
  const router = useRouter()
  // Список тарифов не редактируется на месте: после изменения роут студии
  // отдаёт свежие данные, и страница перечитывается через router.refresh().
  const [tiers] = useState<Tier[]>(initial)
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
  const [badge, setBadge] = useState(tier?.badge || '')
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
        badge: badge.trim(),
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

      <label className="studio-field">
        <span className="studio-field__label">Плашка на витрине (необязательно)</span>
        <input className="studio-input" value={badge} onChange={(e) => setBadge(e.target.value)} placeholder="Популярный" maxLength={20} />
        <span className="settings__hint">Метка на карточке тарифа: «Популярный», «Выгодно». Выделяет тариф рамкой и яркой кнопкой. Пусто — без плашки.</span>
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
