'use client'

import React, { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Check, GripVertical, Pencil, Plus, X, Sliders, ChevronDown, LayoutGrid } from 'lucide-react'
import {
  DEFAULT_HOME_SECTIONS,
  HOME_SECTION_DEFS,
  type HomeSectionConfig,
  type HomeSectionType,
  type HomeSourceKind,
} from '@/lib/homeSections'
import { HeroTeamEditPanel } from './HeroTeamEditPanel'
import { HomeCategoriesEditPanel } from './HomeCategoriesEditPanel'
import { HeroEditPanel } from './HeroEditPanel'
import { BannerEditPanel } from './BannerEditPanel'
import { SectionLibrary } from './SectionLibrary'
import type { CatItem } from './CategoryMultiPicker'

/** type → человекочитаемый лейбл (из единого источника). */
const LABELS: Record<HomeSectionType, string> = HOME_SECTION_DEFS.reduce(
  (acc, d) => {
    acc[d.type] = d.label
    return acc
  },
  {} as Record<HomeSectionType, string>,
)

/**
 * Дефолтные заголовки списочных секций — показываем как placeholder в поле
 * «Заголовок», чтобы владелец видел, что будет без своего текста. Должны
 * совпадать с LIST_HEADINGS в page.tsx.
 */
const DEFAULT_HEADINGS: Partial<Record<HomeSectionType, string>> = {
  news: 'Новости',
  latest: 'Последние публикации',
  popular: 'Сейчас популярно',
  discussed: 'Обсуждаемое',
  popularCategories: 'Популярные разделы',
  carousel: 'Подборка',
  posterGrid: 'Афиша',
}

/**
 * Пер-секционные настройки: какие поля показывать в панели конфигурации.
 *  - heading: у всех конфигурируемых секций есть свой заголовок;
 *  - source: списочные секции умеют тянуть данные из источника (авто/категория).
 * Наличие записи здесь = у секции появляется кнопка «настроить» (ползунки).
 */
const CONFIGURABLE: Partial<Record<HomeSectionType, { source: boolean }>> = {
  news: { source: true },
  latest: { source: true },
  popular: { source: true },
  discussed: { source: true },
  popularCategories: { source: false },
  carousel: { source: true },
  posterGrid: { source: true },
  photoShowcase: { source: false },
}

/**
 * Секции, которые можно добавлять несколько раз (напр. две ленты «Последние
 * публикации» из разных категорий). Остальные — синглтоны (один Hero и т.п.).
 */
const DUPLICABLE = new Set<HomeSectionType>(['news', 'latest', 'popular', 'discussed', 'carousel', 'posterGrid', 'photoShowcase'])

/** Варианты источника контента для списочных секций (UI-лейблы). */
const SOURCE_KIND_LABELS: { value: HomeSourceKind; label: string }[] = [
  { value: 'auto', label: 'Авто (лента по умолчанию)' },
  { value: 'category', label: 'По категории' },
]

/**
 * Общий контракт компонента-редактора КОНТЕНТА секции (тенант-уровневые
 * синглтоны: Hero, участники, плитки категорий, баннер). Выдвижная панель сама
 * грузит/сохраняет свои данные. onClose закрывает, onSaved — после сохранения.
 */
type SectionEditor = (props: { onClose: () => void; onSaved: () => void }) => React.ReactNode

/**
 * Карта type → редактор контента. Карандаш показывается только у секций,
 * для которых редактор есть. Это НЕ пер-секционный config — это общие данные
 * секции для тенанта (одни на все экземпляры типа).
 */
const SECTION_EDITORS: Partial<Record<HomeSectionType, SectionEditor>> = {
  hero: HeroEditPanel,
  heroTeam: HeroTeamEditPanel,
  categories: HomeCategoriesEditPanel,
  broadcast: BannerEditPanel,
}

/** Строка конструктора = конфиг секции + клиентский стабильный ключ (_uid). */
type Row = HomeSectionConfig & { _uid: string }

/** Плоский список категорий с отступом по глубине (для нативного select). */
function flattenCats(cats: CatItem[]): { id: string; label: string }[] {
  const byId = new Map<string, CatItem>()
  cats.forEach((c) => byId.set(String(c.id), c))
  const childrenOf = new Map<string, CatItem[]>()
  cats.forEach((c) => {
    const pid = c.parentId != null ? String(c.parentId) : ''
    if (!childrenOf.has(pid)) childrenOf.set(pid, [])
    childrenOf.get(pid)!.push(c)
  })
  childrenOf.forEach((arr) => arr.sort((a, b) => a.title.localeCompare(b.title, 'ru')))
  const out: { id: string; label: string }[] = []
  const roots = (childrenOf.get('') ?? []).filter((c) => {
    const pid = c.parentId != null ? String(c.parentId) : ''
    return pid === '' || !byId.has(pid)
  })
  const walk = (node: CatItem, depth: number) => {
    out.push({ id: String(node.id), label: `${'— '.repeat(depth)}${node.title}` })
    for (const ch of childrenOf.get(String(node.id)) ?? []) walk(ch, depth + 1)
  }
  roots.forEach((r) => walk(r, 0))
  return out
}

/**
 * Конструктор главной: порядок (drag-and-drop), видимость (тумблер) и
 * пер-секционные настройки (заголовок + источник). Дубли типов разрешены для
 * списочных секций (ключ по _uid). Первое сохранение материализует конфиг в
 * SiteSettings.homeSections.
 */
export function HomeBuilder({ initial }: { initial: HomeSectionConfig[] }) {
  const router = useRouter()
  const uidSeq = useRef(0)
  const nextUid = () => `u${uidSeq.current++}`

  const [rows, setRows] = useState<Row[]>(() =>
    (initial.length > 0 ? initial : DEFAULT_HOME_SECTIONS).map((r) => ({
      ...r,
      _uid: r.id != null ? `db-${r.id}` : `u${uidSeq.current++}`,
    })),
  )
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // тип секции, чей КОНТЕНТ редактируется в выдвижной панели (null — закрыта)
  const [editingType, setEditingType] = useState<HomeSectionType | null>(null)
  // _uid строки, чья панель НАСТРОЕК (заголовок/источник) раскрыта (null — все свёрнуты)
  const [configUid, setConfigUid] = useState<string | null>(null)
  // открыта ли «Библиотека секций» (окно каталога с превью)
  const [libOpen, setLibOpen] = useState(false)

  // Категории тенанта для селекта источника — грузим лениво при первом открытии
  // панели настроек списочной секции.
  const [cats, setCats] = useState<CatItem[] | null>(null)
  const [catsLoading, setCatsLoading] = useState(false)
  const [folders, setFolders] = useState<{ id: number; title: string }[] | null>(null)
  const [foldersLoading, setFoldersLoading] = useState(false)
  const flatCats = useMemo(() => (cats ? flattenCats(cats) : []), [cats])

  const EditorPanel = editingType ? SECTION_EDITORS[editingType] : undefined

  function loadCats() {
    if (cats || catsLoading) return
    setCatsLoading(true)
    fetch('/studio/api/settings/categories-list', { credentials: 'include' })
      .then((r) => r.json())
      .then((res) => {
        const list: any[] = Array.isArray(res?.categories) ? res.categories : []
        setCats(
          list.map((c) => ({ id: c.id, title: c.title ?? '', parentId: c.parentId ?? null })),
        )
      })
      .catch(() => setCats([]))
      .finally(() => setCatsLoading(false))
  }

  function loadFolders() {
    if (folders || foldersLoading) return
    setFoldersLoading(true)
    fetch('/studio/api/settings/gallery-folders-list', { credentials: 'include' })
      .then((r) => r.json())
      .then((res) => setFolders(Array.isArray(res?.folders) ? res.folders : []))
      .catch(() => setFolders([]))
      .finally(() => setFoldersLoading(false))
  }

  function toggle(i: number) {
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, enabled: !row.enabled } : row)))
    setSaved(false)
  }

  // Добавить секцию (в конец, включённой). Синглтон — только если ещё нет;
  // списочную (DUPLICABLE) — можно повторно.
  function addSection(type: HomeSectionType) {
    setRows((r) => {
      if (!DUPLICABLE.has(type) && r.some((row) => row.type === type)) return r
      return [...r, { type, enabled: true, _uid: nextUid() }]
    })
    setSaved(false)
  }

  function removeSection(i: number) {
    setRows((r) => {
      const removed = r[i]
      if (removed && removed._uid === configUid) setConfigUid(null)
      return r.filter((_, idx) => idx !== i)
    })
    setSaved(false)
  }

  // Патч пер-секционного config строки по _uid (мерж вложенных объектов).
  function patchConfig(uid: string, patch: Partial<NonNullable<HomeSectionConfig['config']>>) {
    setRows((r) =>
      r.map((row) =>
        row._uid === uid ? { ...row, config: { ...row.config, ...patch } } : row,
      ),
    )
    setSaved(false)
  }

  // drag-n-drop переупорядочивание (паттерн GalleryComposer)
  function onDrop(target: number) {
    if (dragIndex === null || dragIndex === target) return
    setRows((r) => {
      const next = [...r]
      const [moved] = next.splice(dragIndex, 1)
      next.splice(target, 0, moved)
      return next
    })
    setDragIndex(null)
    setSaved(false)
  }

  async function save() {
    setError(null)
    setSaved(false)
    setSaving(true)
    try {
      // отправляем без клиентского _uid; id прокидываем для стабильности строк
      const payload = rows.map(({ _uid, ...row }) => row)
      const res = await fetch('/studio/api/settings/home-sections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ homeSections: payload }),
      })
      const json = await res.json()
      if (!res.ok) setError(json.error || 'Не удалось сохранить')
      else {
        setSaved(true)
        // освежить публичную главную (новые заголовки/источники)
        router.refresh()
      }
    } catch {
      setError('Ошибка соединения')
    } finally {
      setSaving(false)
    }
  }

  const enabledCount = rows.filter((r) => r.enabled).length

  // Секции, доступные к добавлению: которых ещё нет, ИЛИ дублируемые.
  const availableToAdd = HOME_SECTION_DEFS.filter(
    (d) => DUPLICABLE.has(d.type) || !rows.some((r) => r.type === d.type),
  )

  return (
    <div className="homebld">
      <p className="settings__hint">
        Перетаскивайте секции за ручку, чтобы задать порядок. Тумблер справа включает или
        выключает секцию. Кнопка с ползунками открывает настройки секции: свой заголовок и
        источник контента (лента по умолчанию или конкретная категория). Списочные секции можно
        добавлять несколько раз — например, две ленты из разных разделов. Секции, зависящие от
        данных (участники, категории), скрываются автоматически при отсутствии данных.
      </p>

      <div className="homebld__list">
        {rows.map((row, i) => {
          const conf = CONFIGURABLE[row.type]
          const isOpen = configUid === row._uid
          const src = row.config?.source
          const kind: HomeSourceKind = src?.kind ?? 'auto'
          return (
            <div key={row._uid} className="homebld__row-wrap">
              <div
                className={`homebld__item${dragIndex === i ? ' is-dragging' : ''}${
                  row.enabled ? '' : ' is-off'
                }`}
                draggable
                onDragStart={() => setDragIndex(i)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => onDrop(i)}
                onDragEnd={() => setDragIndex(null)}
              >
                <span className="homebld__grip" title="Перетащите для порядка">
                  <GripVertical size={16} />
                </span>
                <span className="homebld__num">{i + 1}</span>
                <span className="homebld__label">
                  {LABELS[row.type]}
                  {row.config?.heading ? (
                    <span className="homebld__label-note"> · «{row.config.heading}»</span>
                  ) : null}
                </span>

                {conf && (
                  <button
                    className={`catmgr__icon-btn homebld__edit${isOpen ? ' is-active' : ''}`}
                    onClick={() => {
                      const next = isOpen ? null : row._uid
                      setConfigUid(next)
                      if (next && conf.source) loadCats()
                      if (next && row.type === 'photoShowcase') loadFolders()
                    }}
                    title="Настройки секции (заголовок, источник)"
                    aria-expanded={isOpen}
                  >
                    <Sliders size={15} />
                  </button>
                )}

                {SECTION_EDITORS[row.type] && (
                  <button
                    className="catmgr__icon-btn homebld__edit"
                    onClick={() => setEditingType(row.type)}
                    title="Редактировать содержимое секции"
                  >
                    <Pencil size={15} />
                  </button>
                )}

                <label className="homebld__toggle" title={row.enabled ? 'Показывается' : 'Скрыта'}>
                  <input type="checkbox" checked={row.enabled} onChange={() => toggle(i)} />
                  <span className="homebld__toggle-track" aria-hidden="true">
                    <span className="homebld__toggle-thumb" />
                  </span>
                  <span className="homebld__toggle-text">{row.enabled ? 'Вкл' : 'Выкл'}</span>
                </label>

                <button
                  className="catmgr__icon-btn homebld__remove"
                  onClick={() => removeSection(i)}
                  title="Удалить секцию из конфигурации"
                  aria-label="Удалить секцию"
                >
                  <X size={15} />
                </button>
              </div>

              {conf && isOpen && (
                <div
                  className="homebld__config"
                  style={{
                    display: 'grid',
                    gap: 'var(--st-space-3, 12px)',
                    padding: 'var(--st-space-3, 12px) var(--st-space-4, 16px)',
                    marginTop: 4,
                    borderRadius: 'var(--radius-lg, 14px)',
                    border: '1px solid var(--st-border)',
                    background: 'var(--st-surface)',
                  }}
                >
                  <label className="studio-field">
                    <span className="studio-field__label">Заголовок секции</span>
                    <input
                      className="studio-input"
                      type="text"
                      value={row.config?.heading ?? ''}
                      placeholder={DEFAULT_HEADINGS[row.type] ?? 'Заголовок'}
                      onChange={(e) => patchConfig(row._uid, { heading: e.target.value })}
                    />
                  </label>

                  {row.type === 'photoShowcase' && (
                    <label className="studio-field">
                      <span className="studio-field__label">Папка галереи</span>
                      <select
                        className="studio-input"
                        value={row.config?.galleryFolderId != null ? String(row.config.galleryFolderId) : ''}
                        onChange={(ev) => patchConfig(row._uid, { galleryFolderId: ev.target.value ? Number(ev.target.value) : null })}
                      >
                        <option value="">{foldersLoading ? 'Загрузка…' : '— выберите папку —'}</option>
                        {(folders ?? []).map((f) => (
                          <option key={f.id} value={String(f.id)}>{f.title}</option>
                        ))}
                      </select>
                      <span style={{ fontSize: 12, color: 'var(--st-text-muted)', marginTop: 4 }}>
                        Случайное фото из папки на весь экран + кнопка «Смотреть галерею».
                      </span>
                    </label>
                  )}

                  {conf.source && (
                    <>
                      <label className="studio-field">
                        <span className="studio-field__label">Источник контента</span>
                        <div style={{ position: 'relative' }}>
                          <select
                            className="studio-input"
                            value={kind}
                            onChange={(e) => {
                              const nextKind = e.target.value as HomeSourceKind
                              patchConfig(row._uid, {
                                source: {
                                  ...src,
                                  kind: nextKind,
                                  // сбрасываем категорию при уходе с «по категории»
                                  categoryId: nextKind === 'category' ? src?.categoryId ?? null : null,
                                },
                              })
                              if (nextKind === 'category') loadCats()
                            }}
                            style={{ width: '100%', appearance: 'none', backgroundImage: 'none', paddingRight: 32 }}
                          >
                            {SOURCE_KIND_LABELS.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                          <ChevronDown
                            size={15}
                            style={{
                              position: 'absolute',
                              right: 10,
                              top: '50%',
                              transform: 'translateY(-50%)',
                              pointerEvents: 'none',
                              color: 'var(--st-text-muted)',
                            }}
                          />
                        </div>
                      </label>

                      {kind === 'category' && (
                        <label className="studio-field">
                          <span className="studio-field__label">Категория</span>
                          {catsLoading ? (
                            <span
                              className="settings__hint"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                            >
                              <Loader2 size={14} className="spin" /> Загрузка категорий…
                            </span>
                          ) : (
                            <div style={{ position: 'relative' }}>
                              <select
                                className="studio-input"
                                value={src?.categoryId != null ? String(src.categoryId) : ''}
                                onChange={(e) =>
                                  patchConfig(row._uid, {
                                    source: {
                                      ...src,
                                      kind: 'category',
                                      categoryId: e.target.value ? Number(e.target.value) : null,
                                    },
                                  })
                                }
                                style={{ width: '100%', appearance: 'none', backgroundImage: 'none', paddingRight: 32 }}
                              >
                                <option value="">— выберите категорию —</option>
                                {flatCats.map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.label}
                                  </option>
                                ))}
                              </select>
                              <ChevronDown
                                size={15}
                                style={{
                                  position: 'absolute',
                                  right: 10,
                                  top: '50%',
                                  transform: 'translateY(-50%)',
                                  pointerEvents: 'none',
                                  color: 'var(--st-text-muted)',
                                }}
                              />
                            </div>
                          )}
                        </label>
                      )}

                      <label className="studio-field">
                        <span className="studio-field__label">Сколько показывать</span>
                        <input
                          className="studio-input"
                          type="number"
                          min={1}
                          max={50}
                          value={src?.limit ?? ''}
                          placeholder="по умолчанию"
                          onChange={(e) => {
                            const v = e.target.value ? Number(e.target.value) : null
                            patchConfig(row._uid, {
                              source: { ...src, kind, limit: v && v > 0 ? v : null },
                            })
                          }}
                          style={{ maxWidth: 160 }}
                        />
                      </label>
                    </>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="homebld__lib-row">
        <button
          type="button"
          className="homebld__lib-btn"
          onClick={() => setLibOpen(true)}
        >
          <LayoutGrid size={15} /> Библиотека секций
        </button>
        <span className="homebld__lib-hint">Каталог с превью — посмотреть, что умеет каждая, и добавить</span>
      </div>

      {availableToAdd.length > 0 && (
        <div className="homebld__add">
          <span className="homebld__add-label">Добавить секцию:</span>
          <div className="homebld__add-chips">
            {availableToAdd.map((d) => (
              <button
                key={d.type}
                type="button"
                className="homebld__add-chip"
                onClick={() => addSection(d.type)}
              >
                <Plus size={14} />
                {d.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {enabledCount === 0 && (
        <div className="settings__hint homebld__warn">
          Все секции выключены — главная будет пустой.
        </div>
      )}

      {error && <div className="settings__err">{error}</div>}

      <div className="settings__save-row">
        {saved && (
          <span className="settings__saved">
            <Check size={15} /> Сохранено
          </span>
        )}
        <button className="studio-btn studio-btn--primary" onClick={save} disabled={saving}>
          {saving ? <Loader2 size={16} className="spin" /> : null}
          Сохранить главную
        </button>
      </div>

      {EditorPanel && (
        <EditorPanel
          onClose={() => setEditingType(null)}
          onSaved={() => {
            setEditingType(null)
            // освежить возможные превью во вкладке и публичную главную
            router.refresh()
          }}
        />
      )}

      {libOpen && (
        <SectionLibrary
          present={new Set(rows.map((r) => r.type))}
          duplicable={DUPLICABLE}
          onAdd={(type) => addSection(type)}
          onClose={() => setLibOpen(false)}
        />
      )}
    </div>
  )
}
