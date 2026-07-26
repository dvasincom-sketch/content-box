import React from 'react'
import Link from 'next/link'

export type FooterItem = { label: string; href: string }
export type FooterColumn = { heading: string; items: FooterItem[] }
export type SiteFooterProps = {
  brandName?: string
  copyright?: string
  navHeading?: string
  nav?: FooterItem[]
  supportHeading?: string
  support?: FooterItem[]
  columns?: FooterColumn[]   // колонки категорий (BTS, Дискография, Видеография)
  legal?: FooterItem[]       // юридические ссылки (оферта, политика, соглашение)
  paymentCards?: string[]    // принимаемые карты (Visa, Mastercard, МИР)
  complianceNote?: string    // строка о соответствии закону (54-ФЗ, 152-ФЗ)
}

function FooterLinks({ items }: { items: FooterItem[] }) {
  if (!items.length) return null
  return (
    <ul className="flex flex-col gap-2">
      {items.map((item, i) => (
        <li key={i}>
          <Link
            href={item.href}
            className="text-sm c-navlink"
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
 * Нижняя полоса (legal / оплата / соответствие закону) — обязательная
 * коммерческая информация для сайта с приёмом платежей.
 */
export function SiteFooter({
  brandName = '',
  copyright = '',
  navHeading = 'Навигация',
  nav = [],
  supportHeading = 'Поддержка',
  support = [],
  columns = [],
  legal = [],
  paymentCards = [],
  complianceNote = '',
}: SiteFooterProps) {
  const hasBottomBar = legal.length > 0 || paymentCards.length > 0 || !!complianceNote
  return (
    <footer className="max-w-6xl mx-auto px-4 mt-16">
      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-5 pb-10 border-t pt-10"
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
        {columns.map((col) => (
          <nav key={col.heading}>
            <h4 className="text-sm font-semibold uppercase tracking-wide mb-4" style={{ color: 'var(--brand-muted)' }}>
              {col.heading}
            </h4>
            <FooterLinks items={col.items} />
          </nav>
        ))}
        {support.length > 0 && (
          <nav>
            <h4 className="text-sm font-semibold uppercase tracking-wide mb-4" style={{ color: 'var(--brand-muted)' }}>
              {supportHeading}
            </h4>
            <FooterLinks items={support} />
          </nav>
        )}
      </div>

      {hasBottomBar && (
        <div
          className="pb-12 pt-6 flex flex-col gap-5 border-t"
          style={{ borderColor: 'color-mix(in srgb, var(--brand-text) 10%, transparent)' }}
        >
          {legal.length > 0 && (
            <nav className="flex flex-wrap items-center gap-x-5 gap-y-2">
              {legal.map((item, i) => (
                <Link key={i} href={item.href} className="text-sm c-navlink">
                  {item.label}
                </Link>
              ))}
            </nav>
          )}

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
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
            {complianceNote && (
              <p
                className="text-xs sm:text-right"
                style={{ color: 'var(--brand-muted)', margin: 0, maxWidth: 560 }}
              >
                {complianceNote}
              </p>
            )}
          </div>
        </div>
      )}
    </footer>
  )
}
