"use client"

import React, { useState } from 'react'
import Link from '@/components/AppLink'
import { useRouter } from 'next/navigation'
import { Menu, X, Star, Search, ChevronRight, LogOut, FileText, Settings } from 'lucide-react'
import { ThemeToggle } from '@/components/ThemeToggle'
import { DesktopMenu } from '@/components/DesktopMenu'
import { MobileMenu } from '@/components/MobileMenu'
import { InstallPWA } from '@/components/InstallPWA'
import type { MenuNode } from '@/lib/buildMenu'

export type NavItem = { label: string; url: string }
export type HeaderSubscriber = { email?: string | null; displayName?: string | null; avatarUrl?: string | null } | null
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
  supportUrl = '/donate',
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
  const avatarUrl = subscriber?.avatarUrl || null
  const avatarInitial = (subscriberName || '?').charAt(0).toUpperCase()

  return (
    <header
      className="sticky top-0 z-50 backdrop-blur border-b"
      style={{
        background: 'var(--brand-header, color-mix(in srgb, var(--brand-bg) 85%, transparent))',
        borderColor: borderSoft,
      }}
    >
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center justify-between h-16 lg:h-20 gap-4">
          <Link href="/" className="flex items-center gap-2 shrink-0" onClick={() => setOpen(false)}>
            {logoUrl ? (
              // Логотип тенанта: пропорции произвольные, высота фиксирована, а
              // ширина авто — next/image требует явных width/height либо
              // fill с контейнером, и то и другое здесь ломает вёрстку.
              // Файл и так отдаётся с CDN Cloudflare и весит килобайты.
              // eslint-disable-next-line @next/next/no-img-element
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
                className="c-btn c-btn--ghost c-btn--icon c-spotlight"
              >
                <Search size={18} />
              </Link>
              <span className="c-tooltip c-tooltip--below" role="tooltip">Поиск</span>
            </span>

            {/* Установить как приложение — кнопка появляется только если установимо */}
            <InstallPWA />

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
                  <span className="c-avatar c-avatar--soft c-avatar--sm" style={{ overflow: 'hidden' }}>
                    {avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      avatarInitial
                    )}
                  </span>
                </button>
                {menuOpen && (
                  <>
                    <div className="acct-menu__backdrop" onClick={() => setMenuOpen(false)} />
                    <div className="acct-menu__panel" role="menu">
                      {/* Кликабельная карточка профиля вместо неактивного имени. */}
                      <Link href="/account" className="acct-menu__card" onClick={() => setMenuOpen(false)}>
                        <span className="acct-menu__ava">
                          {avatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            avatarInitial
                          )}
                        </span>
                        <span className="acct-menu__id">
                          <span className="acct-menu__name">{subscriberName}</span>
                          {subscriber.displayName && subscriber.email && (
                            <span className="acct-menu__mail">{subscriber.email}</span>
                          )}
                        </span>
                      </Link>
                      <Link href="/account/publications" className="acct-menu__item" onClick={() => setMenuOpen(false)}>
                        <FileText size={16} /> Мои публикации
                      </Link>
                      <Link href="/account/settings" className="acct-menu__item" onClick={() => setMenuOpen(false)}>
                        <Settings size={16} /> Настройки
                      </Link>
                      <div className="acct-menu__sep" />
                      <button
                        type="button"
                        className="acct-menu__item acct-menu__item--danger"
                        onClick={() => { setMenuOpen(false); logout() }}
                        disabled={loggingOut}
                      >
                        <LogOut size={16} /> {loggingOut ? '…' : 'Выйти'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="hidden sm:flex items-center gap-1">
                <Link href="/login" className="c-btn c-btn--ghost c-btn--pill c-btn--sm">Войти</Link>
                <Link href="/register" className="c-btn c-btn--ghost c-btn--pill c-btn--sm">Регистрация</Link>
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
              className="c-btn c-btn--ghost c-btn--icon lg:hidden"
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
                  {/* Кликабельная карточка профиля вместо неактивного имени. */}
                  <Link
                    href="/account"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 py-2 px-2 rounded-xl c-navlink"
                  >
                    <span
                      style={{
                        display: 'grid',
                        placeItems: 'center',
                        width: 40,
                        height: 40,
                        flex: 'none',
                        borderRadius: 12,
                        fontWeight: 700,
                        background: 'color-mix(in srgb, var(--brand-primary) 16%, transparent)',
                        color: 'var(--brand-text)',
                        overflow: 'hidden',
                      }}
                    >
                      {avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        avatarInitial
                      )}
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontWeight: 600, lineHeight: 1.3, color: 'var(--brand-text)' }}>
                        {subscriberName}
                      </span>
                      {subscriber.displayName && subscriber.email && (
                        <span
                          style={{
                            display: 'block',
                            fontSize: 12,
                            lineHeight: 1.2,
                            color: 'var(--brand-muted)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {subscriber.email}
                        </span>
                      )}
                    </span>
                    <ChevronRight size={18} style={{ color: 'var(--brand-muted)', flex: 'none' }} />
                  </Link>
                  <button
                    type="button"
                    onClick={() => { setOpen(false); logout() }}
                    disabled={loggingOut}
                    className="c-navlink py-2 px-2 rounded-lg text-base font-medium text-left flex items-center gap-2"
                    style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    <LogOut size={18} /> {loggingOut ? 'Выхожу…' : 'Выйти'}
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
