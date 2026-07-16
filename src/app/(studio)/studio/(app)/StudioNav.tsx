'use client'

import React from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { LayoutDashboard, FileText, FolderTree, Settings, LogOut } from 'lucide-react'

type NavItem = { href: string; label: string; icon: React.ReactNode; exact?: boolean }

const NAV: NavItem[] = [
  { href: '/studio', label: 'Дашборд', icon: <LayoutDashboard size={18} />, exact: true },
  { href: '/studio/posts', label: 'Публикации', icon: <FileText size={18} /> },
  { href: '/studio/categories', label: 'Категории', icon: <FolderTree size={18} /> },
  { href: '/studio/settings', label: 'Настройки', icon: <Settings size={18} /> },
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
        <div className="studio-nav__brand-mark">{brandName.charAt(0).toUpperCase()}</div>
        <div className="studio-nav__brand-text">
          <span className="studio-nav__brand-name">{brandName}</span>
          <span className="studio-nav__brand-sub">Студия</span>
        </div>
      </div>

      <nav className="studio-nav__list">
        {NAV.map((item) => {
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
      </nav>

      <div className="studio-nav__footer">
        <div className="studio-nav__user">
          <div className="studio-nav__avatar">{authorEmail.charAt(0).toUpperCase()}</div>
          <span className="studio-nav__email" title={authorEmail}>{authorEmail}</span>
        </div>
        <a href="/studio/logout" className="studio-nav__logout" title="Выйти">
          <LogOut size={16} />
        </a>
      </div>
    </aside>
  )
}
