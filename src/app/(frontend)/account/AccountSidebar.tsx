'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { User, FileText, Settings, CreditCard, LogOut, Rss, Bookmark, History } from 'lucide-react'

const NAV = [
  { href: '/account', label: 'Профиль', Icon: User, exact: true },
  { href: '/account/feed', label: 'Лента', Icon: Rss },
  { href: '/account/publications', label: 'Мои публикации', Icon: FileText },
  { href: '/account/saved', label: 'Сохранённое', Icon: Bookmark },
  { href: '/account/history', label: 'История', Icon: History },
  { href: '/account/settings', label: 'Настройки', Icon: Settings },
  { href: '/subscribe', label: 'Подписка', Icon: CreditCard },
]

export function AccountSidebar({ name, email, avatarUrl }: { name: string; email: string; avatarUrl: string | null }) {
  const pathname = usePathname()
  async function logout() {
    try { await fetch('/api/subscribers/logout', { method: 'POST' }) } catch {}
    window.location.href = '/'
  }
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
      {NAV.map((n) => {
        const active = n.exact ? pathname === n.href : pathname.startsWith(n.href)
        const Icon = n.Icon
        return (
          <Link key={n.href} href={n.href} className={`acct__nav-item${active ? ' is-active' : ''}`}>
            <Icon size={18} /> {n.label}
          </Link>
        )
      })}
      <button
        type="button"
        onClick={logout}
        className="acct__nav-item"
        style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%' }}
      >
        <LogOut size={18} /> Выйти
      </button>
    </aside>
  )
}
