'use client'

import React, { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Search, Plus, Check } from 'lucide-react'
import {
  HOME_SECTION_CATALOG,
  SECTION_GROUPS,
  type SectionGroup,
} from '@/lib/homeSectionCatalog'
import type { HomeSectionType } from '@/lib/homeSections'
import { SectionSkeleton } from './SectionSkeleton'

/**
 * Библиотека секций — окно каталога: превью + описание + возможности каждой
 * секции, с добавлением в конструктор. Вкладки-группы + поиск.
 *
 * Статус карточки:
 *  - «есть» (available) — реализована; можно добавить (или «Добавлено», если
 *    синглтон уже в конфиге);
 *  - «скоро» (soon) — в планах, кнопка неактивна.
 *
 * Портал в body + .studio-portal (как HomeCategoriesEditPanel). onAdd кладёт
 * секцию в конструктор; окно остаётся открытым (можно добавить несколько).
 */

const TABS: readonly (SectionGroup | 'Все')[] = ['Все', ...SECTION_GROUPS]

export function SectionLibrary({
  present,
  duplicable,
  onAdd,
  onClose,
}: {
  present: Set<string>
  duplicable: Set<string>
  onAdd: (type: HomeSectionType) => void
  onClose: () => void
}) {
  const [mounted, setMounted] = useState(false)
  const [active, setActive] = useState<SectionGroup | 'Все'>('Все')
  const [query, setQuery] = useState('')
  const [justAdded, setJustAdded] = useState<string | null>(null)

  React.useEffect(() => setMounted(true), [])

  const items = useMemo(() => {
    const q = query.trim().toLowerCase()
    return HOME_SECTION_CATALOG.filter((e) => {
      if (active !== 'Все' && e.group !== active) return false
      if (q && !(e.title + ' ' + e.description).toLowerCase().includes(q)) return false
      return true
    })
  }, [active, query])

  function handleAdd(type: string) {
    onAdd(type as HomeSectionType)
    setJustAdded(type)
    window.setTimeout(() => setJustAdded((v) => (v === type ? null : v)), 1400)
  }

  const panel = (
    <div className="studio-portal">
      <div className="catedit__overlay" onClick={onClose}>
        <div className="seclib" onClick={(e) => e.stopPropagation()}>
          <div className="seclib__head">
            <div className="seclib__title">
              <h3>Библиотека секций</h3>
              <div className="seclib__sub">
                Выбирайте блоки для главной — видно, как выглядит и что умеет каждый
              </div>
            </div>
            <div className="seclib__search">
              <Search size={14} className="seclib__search-icon" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Поиск секции…"
              />
            </div>
            <button className="catmgr__icon-btn" onClick={onClose} title="Закрыть">
              <X size={18} />
            </button>
          </div>

          <div className="seclib__tabs">
            {TABS.map((t) => (
              <button
                key={t}
                className={`seclib__tab${active === t ? ' is-on' : ''}`}
                onClick={() => setActive(t)}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="seclib__grid">
            {items.length === 0 ? (
              <div className="seclib__empty">Ничего не найдено</div>
            ) : (
              items.map((e) => {
                const soon = e.status === 'soon'
                const already = present.has(e.type) && !duplicable.has(e.type)
                const disabled = soon || already
                const added = justAdded === e.type
                return (
                  <div key={e.type} className="seclib__card">
                    <div className="seclib__prev">
                      <span className={`seclib__badge${soon ? ' is-soon' : ' is-have'}`}>
                        {soon ? 'скоро' : 'есть'}
                      </span>
                      <SectionSkeleton kind={e.preview} />
                    </div>
                    <div className="seclib__body">
                      <h4>{e.title}</h4>
                      <p>{e.description}</p>
                      <div className="seclib__chips">
                        {e.capabilities.map((c) => (
                          <span key={c} className="seclib__chip">
                            {c}
                          </span>
                        ))}
                      </div>
                      <button
                        className={`seclib__add${added ? ' is-added' : ''}`}
                        disabled={disabled}
                        onClick={() => !disabled && handleAdd(e.type)}
                      >
                        {soon ? (
                          'Скоро'
                        ) : already ? (
                          <>
                            <Check size={14} /> Добавлено
                          </>
                        ) : added ? (
                          <>
                            <Check size={14} /> Добавлено
                          </>
                        ) : (
                          <>
                            <Plus size={14} /> Добавить
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          <div className="seclib__foot">
            <span>{items.length} секций</span>
            <span className="seclib__legend">
              <b className="seclib__lg-have">есть</b> — уже реализовано ·{' '}
              <b className="seclib__lg-soon">скоро</b> — в планах
            </span>
          </div>
        </div>
      </div>
    </div>
  )

  if (!mounted) return null
  return createPortal(panel, document.body)
}
