import React from 'react'
import Image from 'next/image'

export type CategoryTile = {
  id: string | number
  title: string
  href: string
  cover?: { url?: string | null; alt?: string | null } | string | number | null
}

export type CategoriesGridBlockProps = {
  heading?: string
  items: CategoryTile[]
}

function coverUrl(cover: CategoryTile['cover']): string | null {
  if (cover && typeof cover === 'object' && cover.url) return cover.url
  return null
}

export function CategoriesGridBlock({ heading = 'Категории', items }: CategoriesGridBlockProps) {
  if (!items || items.length === 0) return null

  return (
    <section className="mt-14">
      <h2 className="text-2xl lg:text-3xl font-bold mb-6" style={{ color: 'var(--brand-text)', fontFamily: 'var(--font-heading)', fontWeight: 'var(--heading-weight)' as any }}>
        {heading}
      </h2>
      <div className="grid gap-5 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((c) => {
          const url = coverUrl(c.cover)
          // Без обложки — стеклянная плашка со спотлайтом (без градиента-заглушки).
          if (!url) {
            return (
              <a
                key={c.id}
                href={c.href}
                className="c-card c-card--interactive c-spotlight aspect-[4/3] p-5 flex items-end"
              >
                <h3 className="font-semibold text-lg leading-tight" style={{ color: 'var(--brand-text)' }}>
                  {c.title}
                </h3>
              </a>
            )
          }
          // Есть обложка — афиша с фото и скримом.
          return (
            <a
              key={c.id}
              href={c.href}
              className="c-tile aspect-[4/3] p-5"
            >
              <Image
                src={url}
                alt={(typeof c.cover === 'object' && c.cover?.alt) || c.title}
                fill
                className="object-cover"
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              />
              <div className="c-tile__scrim" />
              <h3 className="relative font-semibold text-white text-lg leading-tight">
                {c.title}
              </h3>
            </a>
          )
        })}
      </div>
    </section>
  )
}
