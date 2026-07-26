import React from 'react'
import Link from 'next/link'

export type Crumb = { url?: string | null; label?: string | null }

/**
 * Хлебные крошки — единый элемент кита (.breadcrumbs): приглушённая плашка,
 * разделитель «›», ссылки на /category/*. Используется на страницах категории
 * и публикации (и в /ui как канон).
 * lastIsCurrent — последняя крошка = текущая страница (текст, не ссылка);
 * нужно на странице категории, где сама категория входит в путь.
 */
export function Breadcrumbs({
  crumbs,
  className = '',
  lastIsCurrent = false,
  homeHref = '/',
  homeLabel = 'Главная',
}: {
  crumbs: Crumb[]
  className?: string
  lastIsCurrent?: boolean
  homeHref?: string
  homeLabel?: string
}) {
  return (
    <nav
      className={`breadcrumbs flex items-center gap-x-1.5 text-sm rounded-xl px-3 py-2 overflow-x-auto ${className}`}
      style={{
        color: 'var(--brand-text)',
        background: 'color-mix(in srgb, var(--brand-text) 6%, transparent)',
      }}
      aria-label="Хлебные крошки"
    >
      <Link href={homeHref} className="whitespace-nowrap shrink-0 c-navlink">
        {homeLabel}
      </Link>
      {crumbs.map((crumb, i) => {
        const isCurrent = lastIsCurrent && i === crumbs.length - 1
        return (
          <span key={crumb.url ?? i} className="flex items-center gap-x-1.5 shrink-0">
            <span aria-hidden="true" style={{ color: 'var(--brand-muted)' }}>›</span>
            {isCurrent ? (
              <span aria-current="page" className="whitespace-nowrap" style={{ color: 'var(--brand-text)' }}>
                {crumb.label}
              </span>
            ) : (
              <Link href={`/category${crumb.url}`} className="whitespace-nowrap c-navlink">
                {crumb.label}
              </Link>
            )}
          </span>
        )
      })}
    </nav>
  )
}
