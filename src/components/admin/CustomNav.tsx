'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

/**
 * Кастомная навигация админки «Контент Бокс».
 * Полностью заменяет штатный сайдбар Payload (admin.components.Nav).
 *
 * Структура задана статически — полный контроль порядка, групп, иконок.
 * Без сворачивания групп (заголовки статичны) — надёжнее, нет getPreference.
 * Единый hover для всех пунктов. Активный пункт — фиолетовый.
 *
 * Клиентский компонент: usePathname для подсветки активного пункта.
 */

type NavItem = { label: string; href: string; icon: React.ReactNode }
type NavGroup = { title: string; items: NavItem[] }

// ── Плоские SVG-иконки (currentColor) ──
const I = {
  category: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z"/></svg>
  ),
  doc: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>
  ),
  page: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
  ),
  video: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m22 8-6 4 6 4V8zM2 6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z"/></svg>
  ),
  media: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.09-3.09a2 2 0 0 0-2.82 0L6 21"/></svg>
  ),
  crown: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7zM5 20h14"/></svg>
  ),
  users: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>
  ),
  settings: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
  ),
  seo: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
  ),
  stats: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18M18 17V9M13 17V5M8 17v-3"/></svg>
  ),
  help: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01"/></svg>
  ),
  building: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4M8 6h.01M16 6h.01M8 10h.01M16 10h.01M8 14h.01M16 14h.01"/></svg>
  ),
  shield: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
  ),
}

// ── Структура меню (порядок задан явно) ──
// admin-префикс добавляется в компоненте.
const GROUPS: NavGroup[] = [
  {
    title: 'Контент',
    items: [
      { label: 'Категории', href: '/collections/categories', icon: I.category },
      { label: 'Публикации', href: '/collections/publications', icon: I.doc },
      { label: 'Страницы', href: '/collections/pages', icon: I.page },
      { label: 'Видео', href: '/collections/videos', icon: I.video },
      { label: 'Медиафайлы', href: '/collections/media', icon: I.media },
    ],
  },
  {
    title: 'Подписки',
    items: [
      { label: 'Подписки', href: '/collections/subscription-tiers', icon: I.crown },
      { label: 'Подписчики', href: '/collections/subscribers', icon: I.users },
    ],
  },
  {
    title: 'Настройки',
    items: [
      { label: 'Настройки сайта', href: '/collections/site-settings', icon: I.settings },
    ],
  },
  {
    title: 'Инструменты',
    items: [
      { label: 'SEO-аудит', href: '/seo-audit', icon: I.seo },
      { label: 'Статистика', href: '/stats', icon: I.stats },
      { label: 'Помощь', href: '/help', icon: I.help },
    ],
  },
  {
    title: 'Администрирование',
    items: [
      { label: 'Проекты', href: '/collections/tenants', icon: I.building },
      { label: 'Сотрудники', href: '/collections/users', icon: I.shield },
    ],
  },
]

const ADMIN = '/admin'

export default function CustomNav() {
  const pathname = usePathname()

  return (
    <nav
      className="nav"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
        padding: '20px 14px',
      }}
    >
      {GROUPS.map((group) => (
        <div key={group.title}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              opacity: 0.45,
              padding: '0 10px',
              marginBottom: 8,
              color: 'var(--theme-text)',
            }}
          >
            {group.title}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {group.items.map((item) => {
              const full = ADMIN + item.href
              const active = pathname === full || pathname.startsWith(full + '/')
              return (
                <Link
                  key={item.href}
                  href={full}
                  className="cb-nav-link"
                  data-active={active ? 'true' : undefined}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '9px 10px',
                    borderRadius: 8,
                    fontSize: 14,
                    fontWeight: active ? 600 : 400,
                    textDecoration: 'none',
                    color: active ? '#7c3aed' : 'var(--theme-text)',
                    background: active
                      ? 'color-mix(in srgb, #7c3aed 12%, transparent)'
                      : 'transparent',
                    transition: 'background 0.15s, color 0.15s',
                  }}
                >
                  <span style={{ display: 'inline-flex', opacity: active ? 1 : 0.7, flexShrink: 0 }}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </div>
        </div>
      ))}
    </nav>
  )
}
