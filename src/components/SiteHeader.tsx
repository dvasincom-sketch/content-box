"use client"

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Menu, X, Star, Search } from 'lucide-react'
import { ThemeToggle } from '@/components/ThemeToggle'
import { DesktopMenu } from '@/components/DesktopMenu'
import { MobileMenu } from '@/components/MobileMenu'
import type { MenuNode } from '@/lib/headerMenu'

export type NavItem = { label: string; url: string }
export type HeaderSubscriber = { email?: string | null; displayName?: string | null } | null
export type SiteHeaderProps = {
  logoUrl?: string | null
  logoAlt?: string | null
  brandName: string
  nav: NavItem[]           // страницы («О проекте»)
  menu?: MenuNode[]        // дерево категорий
  supportLabel?: string
  supportUrl?: string
  subscriber?: HeaderSubscriber   // текущий залогиненный зритель (или null)
}

export function SiteHeader({
  logoUrl,
  logoAlt,
  brandName,
  nav,
  menu = [],
  supportLabel = 'Поддержать проект',
  supportUrl = '#support',
  subscriber = null,
}: SiteHeaderProps) {
  const [open, setOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const router = useRouter()
  const items = nav ?? []

  const borderSoft = 'color-mix(in srgb, var(--brand-text) 12%, transparent)'

  async function logout() {
    setLoggingOut(true)
    try {
      await fetch('/api/subscribers/logout', { method: 'POST' })
      router.push('/')
      router.refresh()
    } catch {
      setLoggingOut(false)
    }
  }

  const subscriberName = subscriber?.displayName || subscriber?.email || 'Профиль'

  return (
    <header
      className="sticky top-0 z-50 backdrop-blur border-b"
      style={{
        background: 'color-mix(in srgb, var(--brand-bg) 85%, transparent)',
        borderColor: borderSoft,
      }}
    >
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center justify-between h-16 lg:h-20 gap-4">
          <Link href="/" className="flex items-center gap-2 shrink-0" onClick={() => setOpen(false)}>
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={logoAlt || brandName}
                style={{ height: '36px', width: 'auto', maxHeight: '36px', objectFit: 'contain', display: 'block' }}
              />
            ) : (
              <span className="text-lg lg:text-xl font-extrabold tracking-tight" style={{ color: 'var(--brand-text)' }}>
                {brandName}
              </span>
            )}
          </Link>

          <nav className="hidden lg:flex items-center gap-7">
            <DesktopMenu nodes={menu} />
            {items.map((item, i) => (
              <Link key={i} href={item.url} className="text-sm font-medium c-navlink">
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            {/* Поиск — доступен на любой странице (десктоп и мобайл) */}
            <span className="c-tooltip-wrap">
              <Link
                href="/search"
                aria-label="Поиск"
                className="c-btn c-btn--surface c-btn--icon c-spotlight"
              >
                <Search size={18} />
              </Link>
              <span className="c-tooltip c-tooltip--below" role="tooltip">Поиск</span>
            </span>

            {/* Авторизация (десктоп) — аватар с выпадающим меню */}
            {subscriber ? (
              <div className="hidden sm:block acct-menu">
                <button
                  type="button"
                  className="acct-menu__trigger"
                  onClick={() => setMenuOpen((v) => !v)}
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  title="Аккаунт"
                >
                  <span className="c-avatar c-avatar--soft c-avatar--sm">
                    {(subscriberName || '?').charAt(0).toUpperCase()}
                  </span>
                </button>
                {menuOpen && (
                  <>
                    <div className="acct-menu__backdrop" onClick={() => setMenuOpen(false)} />
                    <div className="acct-menu__panel" role="menu">
                      <div className="acct-menu__head">{subscriberName}</div>
                      <Link href="/account" className="acct-menu__item" onClick={() => setMenuOpen(false)}>Профиль</Link>
                      <Link href="/account/publications" className="acct-menu__item" onClick={() => setMenuOpen(false)}>Мои публикации</Link>
                      <Link href="/account/settings" className="acct-menu__item" onClick={() => setMenuOpen(false)}>Настройки</Link>
                      <button
                        type="button"
                        className="acct-menu__item acct-menu__item--danger"
                        onClick={() => { setMenuOpen(false); logout() }}
                        disabled={loggingOut}
                      >
                        {loggingOut ? '…' : 'Выйти'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="c-segment hidden sm:inline-flex">
                <Link href="/login" className="c-segment__item">Войти</Link>
                <span className="c-segment__divider" />
                <Link href="/register" className="c-segment__item c-segment__item--primary">Регистрация</Link>
              </div>
            )}

            <Link
              href={supportUrl}
              className="c-btn c-btn--primary c-btn--pill c-btn--sm c-spotlight c-spotlight-bright hidden sm:inline-flex"
            >
              <Star size={15} />
              {supportLabel}
            </Link>
            <ThemeToggle />
            <button
              type="button"
              aria-label="Меню"
              className="c-btn c-btn--surface c-btn--icon lg:hidden"
              onClick={() => setOpen((v) => !v)}
            >
              {open ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {open && (
          <nav
            className="lg:hidden pb-4 flex flex-col gap-1 border-t pt-3"
            style={{ borderColor: borderSoft }}
          >
            <Link
              href="/search"
              onClick={() => setOpen(false)}
              className="c-navlink py-2 px-2 rounded-lg text-base font-medium inline-flex items-center gap-2"
            >
              <Search size={18} /> Поиск
            </Link>

            <MobileMenu nodes={menu} onNavigate={() => setOpen(false)} />
            {items.map((item, i) => (
              <Link
                key={i}
                href={item.url}
                onClick={() => setOpen(false)}
                className="c-navlink py-2 px-2 rounded-lg text-base font-medium"
              >
                {item.label}
              </Link>
            ))}

            {/* Авторизация (мобайл) */}
            <div className="mt-2 pt-2 border-t flex flex-col gap-1" style={{ borderColor: borderSoft }}>
              {subscriber ? (
                <>
                  <span className="py-2 px-2 text-base" style={{ color: 'var(--brand-muted)' }}>
                    {subscriberName}
                  </span>
                  <Link
                    href="/account"
                    onClick={() => setOpen(false)}
                    className="c-navlink py-2 px-2 rounded-lg text-base font-medium"
                  >
                    Мой профиль
                  </Link>
                  <button
                    type="button"
                    onClick={() => { setOpen(false); logout() }}
                    disabled={loggingOut}
                    className="c-navlink py-2 px-2 rounded-lg text-base font-medium text-left"
                    style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    Выйти
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    onClick={() => setOpen(false)}
                    className="c-navlink py-2 px-2 rounded-lg text-base font-medium"
                  >
                    Войти
                  </Link>
                  <Link
                    href="/register"
                    onClick={() => setOpen(false)}
                    className="c-navlink py-2 px-2 rounded-lg text-base font-semibold"
                  >
                    Регистрация
                  </Link>
                </>
              )}
            </div>

            <Link
              href={supportUrl}
              onClick={() => setOpen(false)}
              className="c-btn c-btn--primary c-btn--pill c-btn--sm c-spotlight c-spotlight-bright mt-2 w-max"
            >
              <Star size={15} />
              {supportLabel}
            </Link>
          </nav>
        )}
      </div>
    </header>
  )
}
