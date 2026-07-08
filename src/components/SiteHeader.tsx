"use client"

import React, { useState } from 'react'
import Link from 'next/link'
import { Menu, X, Star } from 'lucide-react'
import { ThemeToggle } from '@/components/ThemeToggle'

export type NavItem = { label: string; url: string }
export type SiteHeaderProps = {
  logoUrl?: string | null
  logoAlt?: string | null
  brandName: string
  nav: NavItem[]
  supportLabel?: string
  supportUrl?: string
}

const DEFAULT_NAV: NavItem[] = [
  { label: 'Главная', url: '/' },
  { label: 'Категории', url: '#categories' },
  { label: 'Расписание эфира', url: '#schedule' },
  { label: 'О проекте', url: '#about' },
]

export function SiteHeader({
  logoUrl,
  logoAlt,
  brandName,
  nav,
  supportLabel = 'Поддержать проект',
  supportUrl = '#support',
}: SiteHeaderProps) {
  const [open, setOpen] = useState(false)
  const items = nav && nav.length > 0 ? nav : DEFAULT_NAV

  const borderSoft = 'color-mix(in srgb, var(--brand-text) 12%, transparent)'
  const supportBorder = 'color-mix(in srgb, var(--brand-primary) 60%, transparent)'

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
            <Link
              href={supportUrl}
              className="hidden sm:inline-flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-full border transition-colors"
              style={{ color: 'var(--brand-text)', borderColor: supportBorder }}
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
            <Link
              href={supportUrl}
              onClick={() => setOpen(false)}
              className="mt-2 inline-flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-full border w-max"
              style={{ color: 'var(--brand-text)', borderColor: supportBorder }}
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
