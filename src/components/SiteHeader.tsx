"use client"

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Menu, X, Star } from 'lucide-react'
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
  const router = useRouter()
  const items = nav ?? []

  const borderSoft = 'color-mix(in srgb, var(--brand-text) 12%, transparent)'
  const supportBorder = 'color-mix(in srgb, var(--brand-primary) 60%, transparent)'

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
              <Link
                key={i}
                href={item.url}
                className="text-sm font-medium opacity-80 hover:opacity-100 transition-opacity"
                style={{ color: 'var(--brand-text)' }}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            {/* Авторизация (десктоп) — вариант B: аккаунт-блок слитно */}
            {subscriber ? (
              <div className="hidden sm:flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-flex items-center justify-center rounded-full text-sm font-semibold"
                    style={{
                      width: 30,
                      height: 30,
                      background: 'color-mix(in srgb, var(--brand-primary) 18%, transparent)',
                      color: 'var(--brand-primary)',
                    }}
                  >
                    {(subscriberName || '?').charAt(0).toUpperCase()}
                  </span>
                  <span className="text-sm opacity-90" style={{ color: 'var(--brand-text)' }}>
                    {subscriberName}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={logout}
                  disabled={loggingOut}
                  className="text-sm font-medium opacity-70 hover:opacity-100 transition-opacity"
                  style={{ color: 'var(--brand-text)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  {loggingOut ? '…' : 'Выйти'}
                </button>
              </div>
            ) : (
              <div
                className="hidden sm:inline-flex items-center rounded-full overflow-hidden"
                style={{ border: `1px solid ${supportBorder}` }}
              >
                <Link
                  href="/login"
                  className="text-sm font-medium px-4 py-2 transition-colors hover:opacity-100 opacity-80"
                  style={{ color: 'var(--brand-text)' }}
                >
                  Войти
                </Link>
                <span style={{ width: 1, alignSelf: 'stretch', background: supportBorder }} />
                <Link
                  href="/register"
                  className="text-sm font-semibold px-4 py-2 transition-colors"
                  style={{
                    color: 'var(--brand-text)',
                    background: 'color-mix(in srgb, var(--brand-surface) 60%, transparent)',
                  }}
                >
                  Регистрация
                </Link>
              </div>
            )}

            <Link
              href={supportUrl}
              className="hidden sm:inline-flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-full transition-colors"
              style={{ color: '#fff', background: 'var(--brand-primary)', border: 'none' }}
            >
              <Star size={15} />
              {supportLabel}
            </Link>
            <ThemeToggle />
            <button
              type="button"
              aria-label="Меню"
              className="lg:hidden inline-flex items-center justify-center h-10 w-10 rounded-lg"
              style={{ color: 'var(--brand-text)', background: 'color-mix(in srgb, var(--brand-surface) 60%, transparent)' }}
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
            <MobileMenu nodes={menu} onNavigate={() => setOpen(false)} />
            {items.map((item, i) => (
              <Link
                key={i}
                href={item.url}
                onClick={() => setOpen(false)}
                className="py-2 px-2 rounded-lg text-base font-medium opacity-90 hover:opacity-100"
                style={{ color: 'var(--brand-text)' }}
              >
                {item.label}
              </Link>
            ))}

            {/* Авторизация (мобайл) */}
            <div className="mt-2 pt-2 border-t flex flex-col gap-1" style={{ borderColor: borderSoft }}>
              {subscriber ? (
                <>
                  <span className="py-2 px-2 text-base opacity-80" style={{ color: 'var(--brand-text)' }}>
                    {subscriberName}
                  </span>
                  <button
                    type="button"
                    onClick={() => { setOpen(false); logout() }}
                    disabled={loggingOut}
                    className="py-2 px-2 rounded-lg text-base font-medium opacity-90 hover:opacity-100 text-left"
                    style={{ color: 'var(--brand-text)', background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    Выйти
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    onClick={() => setOpen(false)}
                    className="py-2 px-2 rounded-lg text-base font-medium opacity-90 hover:opacity-100"
                    style={{ color: 'var(--brand-text)' }}
                  >
                    Войти
                  </Link>
                  <Link
                    href="/register"
                    onClick={() => setOpen(false)}
                    className="py-2 px-2 rounded-lg text-base font-semibold opacity-90 hover:opacity-100"
                    style={{ color: 'var(--brand-text)' }}
                  >
                    Регистрация
                  </Link>
                </>
              )}
            </div>

            <Link
              href={supportUrl}
              onClick={() => setOpen(false)}
              className="mt-2 inline-flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-full w-max"
              style={{ color: '#fff', background: 'var(--brand-primary)', border: 'none' }}
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
