'use client'

import React from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { LayoutDashboard, FileText, FolderTree, Video, Headphones, Settings, LogOut, ShieldCheck } from 'lucide-react'

type NavItem = { href: string; label: string; icon: React.ReactNode; exact?: boolean }

// Меню сгруппировано: «Медиа» объединяет видео и аудио (позже — галерея).
type NavGroup = { label?: string; items: NavItem[] }
const NAV_GROUPS: NavGroup[] = [
  {
    items: [
      { href: '/studio', label: 'Дашборд', icon: <LayoutDashboard size={18} />, exact: true },
      { href: '/studio/posts', label: 'Публикации', icon: <FileText size={18} /> },
    ],
  },
  {
    label: 'Медиа',
    items: [
      { href: '/studio/videos', label: 'Видео', icon: <Video size={18} /> },
      { href: '/studio/audio', label: 'Аудио', icon: <Headphones size={18} /> },
    ],
  },
  {
    items: [
      { href: '/studio/categories', label: 'Категории', icon: <FolderTree size={18} /> },
      { href: '/studio/moderation', label: 'Модерация', icon: <ShieldCheck size={18} /> },
      { href: '/studio/settings', label: 'Настройки', icon: <Settings size={18} /> },
    ],
  },
]

function isActive(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.href
  return pathname === item.href || pathname.startsWith(item.href + '/')
}

export function StudioNav({ authorEmail, brandName }: { authorEmail: string; brandName: string }) {
  const pathname = usePathname()

  return (
    <aside className="studio-nav">
      <div className="studio-nav__brand">
        <div className="studio-nav__brand-mark" aria-label={brandName}>
          <svg
            className="studio-nav__logo"
            width="24"
            height="24"
            viewBox="0 0 52 52"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            role="img"
            aria-hidden="true"
          >
            <g transform="translate(26 26)">
              <path
                className="studio-nav__logo-a"
                d="M-16 -16 H16 V0 L0 16 H-16 Z"
                fill="currentColor"
                opacity="0.9"
              />
              <path
                className="studio-nav__logo-b"
                d="M16 -16 V16 H-16 L16 -16 Z"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinejoin="round"
              />
            </g>
          </svg>
        </div>
        <div className="studio-nav__brand-text">
          <span className="studio-nav__brand-name">{brandName}</span>
          <span className="studio-nav__brand-sub">Студия</span>
        </div>
      </div>

      <nav className="studio-nav__list">
        {NAV_GROUPS.map((group, gi) => (
          <React.Fragment key={gi}>
            {group.label && (
              <div
                className="studio-nav__group-label"
                style={{ padding: '10px 12px 4px', fontSize: 11, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--st-text-muted)' }}
              >
                {group.label}
              </div>
            )}
            {group.items.map((item) => {
              const active = isActive(pathname, item)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`studio-nav__item${active ? ' is-active' : ''}`}
                  aria-current={active ? 'page' : undefined}
                >
                  <span className="studio-nav__icon">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </React.Fragment>
        ))}
      </nav>

      <div className="studio-nav__footer">
        <Link href="/studio/profile" className="studio-nav__user" title="Профиль">
          <div className="studio-nav__avatar">{authorEmail.charAt(0).toUpperCase()}</div>
          <span className="studio-nav__email">{authorEmail}</span>
        </Link>
        <a href="/studio/logout" className="studio-nav__logout" title="Выйти">
          <LogOut size={16} />
        </a>
      </div>
    </aside>
  )
}
