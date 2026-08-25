import React from 'react'
import Image from 'next/image'
import { FolderOpen } from 'lucide-react'
import { PublicationCardView, type PublicationCard } from './LatestPublicationsBlock'

/**
 * Единый смешанный список содержимого категории: публикации и подкатегории идут
 * ОДНОЙ сеткой в ручном порядке (см. lib/categoryContentOrder). Публикации —
 * обычной карточкой (PublicationCardView), подкатегории — карточкой того же
 * формата с обложкой 16:9, заголовком и меткой «Раздел», чтобы плитки в сетке
 * выравнивались. Порядок задаётся вызывающим кодом (страница категории уже
 * передаёт items в нужной последовательности).
 */

export type CategoryTileCard = {
  id: string | number
  title: string
  href: string
  coverUrl?: string | null
  coverAlt?: string | null
}

export type CategoryContentItem =
  | { kind: 'publication'; pub: PublicationCard }
  | { kind: 'category'; cat: CategoryTileCard }

function CategoryCardView({ c }: { c: CategoryTileCard }) {
  return (
    <a href={c.href} className="c-card c-card--interactive c-spotlight overflow-hidden flex flex-col" title={c.title}>
      <div className="relative block aspect-video" style={{ background: 'var(--brand-surface, rgba(127,127,127,.12))' }}>
        {c.coverUrl ? (
          <Image
            src={c.coverUrl}
            alt={c.coverAlt || c.title}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          />
        ) : (
          <span
            className="absolute inset-0 grid place-items-center"
            style={{ color: 'var(--brand-muted)' }}
            aria-hidden
          >
            <FolderOpen size={30} />
          </span>
        )}
        <span
          className="absolute top-3 left-3 inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full"
          style={{ background: 'rgba(0,0,0,0.55)', color: '#fff', backdropFilter: 'blur(4px)' }}
        >
          <FolderOpen size={12} />
          Раздел
        </span>
      </div>
      <div className="p-5 flex flex-col gap-3 flex-1">
        <h3 className="font-semibold leading-snug" style={{ color: 'var(--brand-text)' }}>
          {c.title}
        </h3>
      </div>
    </a>
  )
}

export function CategoryContentGrid({ items }: { items: CategoryContentItem[] }) {
  if (!items || items.length === 0) return null
  return (
    <section className="mt-10">
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((it) =>
          it.kind === 'publication' ? (
            <PublicationCardView key={`p-${it.pub.id}`} p={it.pub} />
          ) : (
            <CategoryCardView key={`c-${it.cat.id}`} c={it.cat} />
          ),
        )}
      </div>
    </section>
  )
}
