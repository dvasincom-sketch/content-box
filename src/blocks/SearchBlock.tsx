import React from 'react'
import Link from 'next/link'
import { SearchBox } from '@/components/search/SearchBox'

export type SearchChip = { title: string; href: string }
export type SearchBlockProps = {
  heading?: string
  chips?: SearchChip[]
}

const DEFAULT_HEADING = 'Что хотите посмотреть?'

/**
 * Секция главной «Поиск»: центрированная стеклянная строка поиска (typeahead из
 * общего SearchBox) под заголовком, с рядом быстрых чипсов популярных категорий.
 * Порядок/видимость задаются конструктором главной (homeSections, type='search').
 */
export function SearchBlock({ heading = DEFAULT_HEADING, chips = [] }: SearchBlockProps) {
  return (
    <section className="mt-10 flex flex-col items-center">
      <h2
        className="text-2xl lg:text-3xl font-bold mb-6 text-center"
        style={{ color: 'var(--brand-text)', fontFamily: 'var(--font-heading)', fontWeight: 'var(--heading-weight)' as any }}
      >
        {heading}
      </h2>
      <div className="w-full max-w-2xl">
        <SearchBox showLockedToggle={false} />
        {chips.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {chips.map((c) => (
              <Link key={c.href} href={c.href} className="pubmeta-chip">
                {c.title}
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
