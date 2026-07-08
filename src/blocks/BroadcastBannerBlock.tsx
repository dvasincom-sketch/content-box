import React from 'react'
import Link from 'next/link'

type NavItem = { label: string; href: string }

export type BroadcastBannerBlockProps = {
  brandName?: string
  onAirText?: string
  tagline?: string
  navHeading?: string
  nav?: NavItem[]
  supportHeading?: string
  support?: NavItem[]
  copyright?: string
}

function FooterLinks({ items }: { items: NavItem[] }) {
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

export function BroadcastBannerBlock({
  brandName = 'COCO JAMBO',
  onAirText = 'ON AIR',
  tagline = 'BTS TV',
  navHeading = 'Навигация',
  nav = [],
  supportHeading = 'Поддержка',
  support = [],
  copyright = '',
}: BroadcastBannerBlockProps) {
  return (
    <footer className="mt-16">
      {/* Неоновый баннер — ВСЕГДА тёмный: неон не читается на светлом фоне. */}
      <div
        className="relative rounded-3xl overflow-hidden px-8 py-14 mb-10 flex flex-col items-center justify-center text-center"
        style={{
          background:
            'radial-gradient(circle at 50% 120%, color-mix(in srgb, var(--brand-primary) 50%, transparent), #140E24 68%)',
        }}
      >
        <span
          className="text-xs font-semibold uppercase tracking-[0.3em] mb-3"
          style={{ color: 'var(--brand-accent)' }}
        >
          {tagline}
        </span>
        <span
          className="text-5xl lg:text-7xl font-extrabold tracking-tight"
          style={{
            color: '#fff',
            textShadow:
              '0 0 6px var(--brand-accent), 0 0 18px var(--brand-accent), 0 0 40px color-mix(in srgb, var(--brand-accent) 55%, transparent)',
          }}
        >
          {onAirText}
        </span>
      </div>

      {/* Футер с навигацией — следует за темой */}
      <div className="grid gap-8 sm:grid-cols-3 pb-10">
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

        <nav>
          <h4
            className="text-sm font-semibold uppercase tracking-wide mb-4"
            style={{ color: 'var(--brand-muted)' }}
          >
            {navHeading}
          </h4>
          <FooterLinks items={nav} />
        </nav>

        <nav>
          <h4
            className="text-sm font-semibold uppercase tracking-wide mb-4"
            style={{ color: 'var(--brand-muted)' }}
          >
            {supportHeading}
          </h4>
          <FooterLinks items={support} />
        </nav>
      </div>
    </footer>
  )
}
