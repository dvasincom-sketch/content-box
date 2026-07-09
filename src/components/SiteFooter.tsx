import React from 'react'
import Link from 'next/link'

export type FooterItem = { label: string; href: string }
export type SiteFooterProps = {
  brandName?: string
  copyright?: string
  navHeading?: string
  nav?: FooterItem[]
  supportHeading?: string
  support?: FooterItem[]
}

function FooterLinks({ items }: { items: FooterItem[] }) {
  if (!items.length) return null
  return (
    <ul className="flex flex-col gap-2">
      {items.map((item, i) => (
        <li key={i}>
          <Link
            href={item.href}
            className="text-sm transition-opacity hover:opacity-100"
            style={{ color: 'var(--brand-text)', opacity: 0.8 }}
          >
            {item.label}
          </Link>
        </li>
      ))}
    </ul>
  )
}

/**
 * Общий футер сайта (в layout, на всех страницах).
 * Колонки наполняются страницами из Pages по showInFooter + footerColumn.
 */
export function SiteFooter({
  brandName = '',
  copyright = '',
  navHeading = 'Навигация',
  nav = [],
  supportHeading = 'Поддержка',
  support = [],
}: SiteFooterProps) {
  return (
    <footer className="max-w-6xl mx-auto px-4 mt-16">
      <div className="grid gap-8 sm:grid-cols-3 pb-10 border-t pt-10"
        style={{ borderColor: 'color-mix(in srgb, var(--brand-text) 12%, transparent)' }}
      >
        <div>
          <span className="text-lg font-bold" style={{ color: 'var(--brand-text)' }}>
            {brandName}
          </span>
          {copyright ? (
            <p className="text-sm mt-3" style={{ color: 'var(--brand-muted)' }}>
              {copyright}
            </p>
          ) : null}
        </div>
        {nav.length > 0 && (
          <nav>
            <h4 className="text-sm font-semibold uppercase tracking-wide mb-4" style={{ color: 'var(--brand-muted)' }}>
              {navHeading}
            </h4>
            <FooterLinks items={nav} />
          </nav>
        )}
        {support.length > 0 && (
          <nav>
            <h4 className="text-sm font-semibold uppercase tracking-wide mb-4" style={{ color: 'var(--brand-muted)' }}>
              {supportHeading}
            </h4>
            <FooterLinks items={support} />
          </nav>
        )}
      </div>
    </footer>
  )
}
