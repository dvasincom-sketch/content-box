import React from 'react'

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
      {/* Неоновый баннер */}
      <div
        className="relative rounded-3xl overflow-hidden px-8 py-14 mb-10 flex flex-col items-center justify-center text-center"
        style={{
          background:
            'radial-gradient(circle at 50% 120%, color-mix(in srgb, var(--brand-primary) 55%, transparent), var(--brand-surface) 70%)',
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
            color: 'var(--brand-accent)',
            textShadow:
              '0 0 8px var(--brand-accent), 0 0 24px var(--brand-accent), 0 0 48px color-mix(in srgb, var(--brand-accent) 60%, transparent)',
          }}
        >
          {onAirText}
        </span>
      </div>

      {/* Футер с навигацией */}
      <div className="grid gap-8 sm:grid-cols-3 pb-10">
        <div>
          <span className="text-lg font-bold" style={{ color: 'var(--brand-text)' }}>
            {brandName}
          </span>
          {copyright && (
            <p className="text-sm mt-3" style={{ color: 'var(--brand-text)', opacity: 0.6 }}>
              {copyright}
            </p>
          )}
        </div>

        <nav>
          <h4
            className="text-sm font-semibold uppercase tracking-wide mb-4"
            style={{ color: 'var(--brand-text)', opacity: 0.6 }}
          >
            {navHeading}
          </h4>
          <ul className="flex flex-col gap-2">
            {nav.map((item, i) => (
              <li key={i}>
                
                <a
                  href={item.href}
                  className="text-sm transition-opacity hover:opacity-100"
                  style={{ color: 'var(--brand-text)', opacity: 0.8 }}
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <nav>
          <h4
            className="text-sm font-semibold uppercase tracking-wide mb-4"
            style={{ color: 'var(--brand-text)', opacity: 0.6 }}
          >
            {supportHeading}
          </h4>
          <ul className="flex flex-col gap-2">
            {support.map((item, i) => (
              <li key={i}>
                
                <a
                  href={item.href}
                  className="text-sm transition-opacity hover:opacity-100"
                  style={{ color: 'var(--brand-text)', opacity: 0.8 }}
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  )
}