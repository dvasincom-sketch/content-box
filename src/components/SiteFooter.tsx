import React from 'react'
import Link from '@/components/AppLink'
import { ContentBoxLogo } from '@/components/ContentBoxLogo'

export type FooterItem = { label: string; href: string }
export type FooterColumn = { heading: string; items: FooterItem[] }
export type SiteFooterProps = {
  brandName?: string
  copyright?: string
  navHeading?: string
  nav?: FooterItem[]
  supportHeading?: string
  support?: FooterItem[]
  columns?: FooterColumn[]
  legal?: FooterItem[]
  paymentCards?: string[]
  complianceNote?: string
}

const PLATFORM_URL = 'https://contentbox.site'

function FooterLinks({ items }: { items: FooterItem[] }) {
  if (!items.length) return null
  return (
    <ul className="flex flex-col gap-2">
      {items.map((item, i) => (
        <li key={i}>
          <Link href={item.href} className="text-sm c-navlink">
            {item.label}
          </Link>
        </li>
      ))}
    </ul>
  )
}

/**
 * Футер сайта. Верх — три колонки: бренд+правовая справка / навигация /
 * витрина платформы «Работает на Контент Бокс». Низ — правовые ссылки и строка
 * соответствия закону в один ряд, ниже — приём карт.
 */
export function SiteFooter({
  brandName = '',
  copyright = '',
  navHeading = 'Навигация',
  nav = [],
  support = [],
  columns = [],
  legal = [],
  paymentCards = [],
  complianceNote = '',
}: SiteFooterProps) {
  const hasBottomBar = legal.length > 0 || paymentCards.length > 0 || !!complianceNote
  const navLinks: FooterItem[] = [...nav, ...columns.flatMap((c) => c.items), ...support]
  const border12 = 'color-mix(in srgb, var(--brand-text) 12%, transparent)'
  const border10 = 'color-mix(in srgb, var(--brand-text) 10%, transparent)'

  return (
    <footer className="max-w-6xl mx-auto px-4 mt-16">
      <div
        className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3 pb-10 border-t pt-12"
        style={{ borderColor: border12 }}
      >
        {/* 1 — Бренд + копирайт/правовая справка */}
        <div>
          <span className="text-lg font-bold" style={{ color: 'var(--brand-text)' }}>
            {brandName}
          </span>
          {copyright ? (
            <p
              className="text-sm mt-3"
              style={{ color: 'var(--brand-muted)', maxWidth: 340, lineHeight: 1.6 }}
            >
              {copyright}
            </p>
          ) : null}
        </div>

        {/* 2 — Навигация */}
        {navLinks.length > 0 ? (
          <nav>
            <h4
              className="text-sm font-semibold uppercase tracking-wide mb-4"
              style={{ color: 'var(--brand-muted)' }}
            >
              {navHeading}
            </h4>
            <FooterLinks items={navLinks} />
          </nav>
        ) : (
          <div aria-hidden />
        )}

        {/* 3 — Витрина платформы: «Работает на Контент Бокс» */}
        <div
          style={{
            border: `1px solid ${border12}`,
            borderRadius: 16,
            padding: 18,
            background: 'color-mix(in srgb, var(--brand-primary) 5%, transparent)',
            alignSelf: 'start',
          }}
        >
          <div
            className="text-xs font-semibold uppercase"
            style={{ color: 'var(--brand-muted)', letterSpacing: '0.08em', marginBottom: 12 }}
          >
            Работает на платформе
          </div>
          <a
            href={PLATFORM_URL}
            target="_blank"
            rel="noopener"
            aria-label="Контент Бокс — система управления платным контентом"
            style={{ display: 'inline-flex', textDecoration: 'none' }}
          >
            <ContentBoxLogo />
          </a>
          <p
            className="text-sm"
            style={{ color: 'var(--brand-muted)', margin: '12px 0 14px', lineHeight: 1.5 }}
          >
            Система управления платным контентом: подписки, видео и сообщество — всё, чтобы
            автору зарабатывать на своём контенте.
          </p>
          <a
            href={PLATFORM_URL}
            target="_blank"
            rel="noopener"
            className="text-sm font-semibold"
            style={{
              color: 'var(--brand-primary)',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            Создать свой фан-сайт
            <span aria-hidden>→</span>
          </a>
        </div>
      </div>

      {hasBottomBar && (
        <div
          className="pb-12 pt-6 flex flex-col gap-5 border-t"
          style={{ borderColor: border10 }}
        >
          {/* Правовые ссылки (слева) + соответствие закону (справа) — один ряд */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: '16px 32px' }}>
            {legal.length > 0 && (
              <nav className="flex flex-wrap items-center gap-x-5 gap-y-2">
                {legal.map((item, i) => (
                  <Link key={i} href={item.href} className="text-sm c-navlink">
                    {item.label}
                  </Link>
                ))}
              </nav>
            )}
            {complianceNote && (
              <p
                className="text-xs"
                style={{
                  color: 'var(--brand-muted)',
                  margin: 0,
                  marginLeft: 'auto',
                  maxWidth: 520,
                  textAlign: 'right',
                }}
              >
                {complianceNote}
              </p>
            )}
          </div>

          {/* Приём карт — отдельной строкой */}
          {paymentCards.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs" style={{ color: 'var(--brand-muted)' }}>
                Оплата картами
              </span>
              {paymentCards.map((c) => (
                <span
                  key={c}
                  className="text-xs font-semibold px-2.5 py-1 rounded-md"
                  style={{
                    color: 'var(--brand-text)',
                    background: 'color-mix(in srgb, var(--brand-text) 6%, transparent)',
                    border: '1px solid color-mix(in srgb, var(--brand-text) 12%, transparent)',
                  }}
                >
                  {c}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </footer>
  )
}
