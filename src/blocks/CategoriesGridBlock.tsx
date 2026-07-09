import React from 'react'
import Image from 'next/image'

export type CategoryTile = {
  id: string | number
  title: string
  slug: string
  cover?: { url?: string | null; alt?: string | null } | string | number | null
}

export type CategoriesGridBlockProps = {
  heading?: string
  items: CategoryTile[]
}

const GRADIENTS = [
  'linear-gradient(135deg, #7C3AED, #EC4899)',
  'linear-gradient(135deg, #6366F1, #8B5CF6)',
  'linear-gradient(135deg, #EC4899, #F59E0B)',
  'linear-gradient(135deg, #8B5CF6, #06B6D4)',
  'linear-gradient(135deg, #F472B6, #A855F7)',
  'linear-gradient(135deg, #3B82F6, #7C3AED)',
  'linear-gradient(135deg, #A855F7, #EC4899)',
]

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
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((c, i) => (
          
          <a
            key={c.id}
            href={`/category/${c.slug}`}
            className="relative rounded-2xl overflow-hidden aspect-[4/3] flex items-end p-4 group"
            style={{ background: GRADIENTS[i % GRADIENTS.length] }}
          >
            {coverUrl(c.cover) && (
              <Image
                src={coverUrl(c.cover) as string}
                alt={(typeof c.cover === 'object' && c.cover?.alt) || c.title}
                fill
                className="object-cover"
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              />
            )}
            <div
              className="absolute inset-0 transition-opacity group-hover:opacity-70"
              style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.6), transparent 65%)' }}
            />
            <h3 className="relative font-semibold text-white text-lg leading-tight">
              {c.title}
            </h3>
          </a>
        ))}
      </div>
    </section>
  )
}
