'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  User, FileText, Settings, CreditCard, LogOut, Rss, Bookmark, BookOpen, History, MoreHorizontal,
} from 'lucide-react'

type NavItem = { href: string; label: string; Icon: typeof User; exact?: boolean }

// Основные разделы контента — на мобильном становятся лентой вкладок.
const NAV_PRIMARY: NavItem[] = [
  { href: '/account', label: 'Профиль', Icon: User, exact: true },
  { href: '/account/feed', label: 'Лента', Icon: Rss },
  { href: '/account/publications', label: 'Мои публикации', Icon: FileText },
  { href: '/account/library', label: 'Библиотека', Icon: BookOpen },
  { href: '/account/saved', label: 'Сохранённое', Icon: Bookmark },
  { href: '/account/history', label: 'История', Icon: History },
]

// Вторичное (сервис/редкое) — на десктопе в общем списке, на мобильном под «⋯».
const NAV_SECONDARY: NavItem[] = [
  { href: '/account/settings', label: 'Настройки', Icon: Settings },
  { href: '/subscribe', label: 'Подписка', Icon: CreditCard },
]

export function AccountSidebar({
  name, email, avatarUrl, showLibrary = true, showHistory = true,
}: { name: string; email: string; avatarUrl: string | null; showLibrary?: boolean; showHistory?: boolean }) {
  const pathname = usePathname()
  const [moreOpen, setMoreOpen] = useState(false)

  // Прячем пустые разделы (Библиотека/История), но не когда пользователь уже на них.
  const primary = NAV_PRIMARY.filter((n) => {
    if (pathname.startsWith(n.href)) return true
    if (n.href === '/account/library') return showLibrary
    if (n.href === '/account/history') return showHistory
    return true
  })

  async function logout() {
    try { await fetch('/api/subscribers/logout', { method: 'POST' }) } catch {}
    window.location.href = '/'
  }

  const isActive = (n: NavItem) => (n.exact ? pathname === n.href : pathname.startsWith(n.href))

  const renderLink = (n: NavItem, onClick?: () => void) => {
    const Icon = n.Icon
    return (
      <Link
        key={n.href}
        href={n.href}
        onClick={onClick}
        className={`acct__nav-item${isActive(n) ? ' is-active' : ''}`}
      >
        <Icon size={18} /> {n.label}
      </Link>
    )
  }

  const logoutBtn = (
    <button
      type="button"
      onClick={logout}
      className="acct__nav-item"
      style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%' }}
    >
      <LogOut size={18} /> Выйти
    </button>
  )

  return (
    <aside className="acct__sidebar">
      <div className="acct__user">
        <span className="acct__ava">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="" />
          ) : (
            (name[0] || '?').toUpperCase()
          )}
        </span>
        <div style={{ minWidth: 0 }}>
          <div className="acct__user-name">{name}</div>
          <div className="acct__user-mail">{email}</div>
        </div>
      </div>

      {/* Обёртка display:contents на десктопе — не влияет на раскладку; на
          мобильном становится строкой «лента + ⋯». */}
      <div className="acct__navbar">
        <nav className="acct__nav">
          {primary.map((n) => renderLink(n))}
        </nav>

        <div className="acct__more">
          <button
            type="button"
            className="acct__more-btn"
            aria-haspopup="menu"
            aria-expanded={moreOpen}
            aria-label="Ещё"
            onClick={() => setMoreOpen((v) => !v)}
          >
            <MoreHorizontal size={18} />
          </button>
          {moreOpen && (
            <>
              <div className="acct__more-backdrop" onClick={() => setMoreOpen(false)} />
              <div className="acct__more-menu" role="menu">
                {NAV_SECONDARY.map((n) => renderLink(n, () => setMoreOpen(false)))}
                {logoutBtn}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Десктопный «хвост» списка: на мобильном скрыт (уходит под «⋯»). */}
      <div className="acct__secondary">
        {NAV_SECONDARY.map((n) => renderLink(n))}
        {logoutBtn}
      </div>
    </aside>
  )
}
