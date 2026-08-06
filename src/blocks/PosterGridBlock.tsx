import Link from '@/components/AppLink'
import React from 'react'
import Image from 'next/image'
import { Lock } from 'lucide-react'
import type { PublicationCard } from './LatestPublicationsBlock'

/**
 * PosterGridBlock — сетка афиш 2:3 из публикаций источника секции
 * (авто/категория/тег/ручной список). Постер = обложка публикации, обрезка под
 * 2:3; под постером — заголовок. Клик ведёт на публикацию.
 *
 * Визуально киношная витрина: несколько рядов афиш (в отличие от одного
 * горизонтального ряда PosterRow, который строится по дочерним категориям).
 * Публикации без обложки показываются буквенным плейсхолдером, чтобы сетка не
 * рвалась. Пустой список не рендерится.
 */

export type PosterGridBlockProps = {
  heading?: string
  items: PublicationCard[]
}

function coverUrl(cover: PublicationCard['cover']): string | null {
  if (cover && typeof cover === 'object' && cover.url) return cover.url
  return null
}

export function PosterGridBlock({ heading = 'Афиша', items }: PosterGridBlockProps) {
  if (!items || items.length === 0) return null

  return (
    <section className="mt-10">
      {heading && (
        <h2
          className="text-2xl lg:text-3xl font-bold mb-6"
          style={{
            color: 'var(--brand-text)',
            fontFamily: 'var(--font-heading)',
            fontWeight: 'var(--heading-weight)' as any,
          }}
        >
          {heading}
        </h2>
      )}

      <div className="poster-grid">
        {items.map((p) => {
          const url = coverUrl(p.cover)
          return (
            <Link
              key={p.id}
              href={`/publication/${p.slug}`}
              prefetch={false}
              className="poster-grid__item"
              title={p.title}
            >
              <div className="poster-card__frame">
                {url ? (
                  <Image
                    src={url}
                    alt={(typeof p.cover === 'object' && p.cover?.alt) || p.title}
                    fill
                    sizes="(max-width: 640px) 45vw, (max-width: 1024px) 22vw, 180px"
                    className="poster-card__img"
                  />
                ) : (
                  <div className="poster-card__placeholder" aria-hidden>
                    {p.title.slice(0, 1).toUpperCase()}
                  </div>
                )}
                {p.minTierName && (
                  <span
                    className="poster-grid__lock"
                    title={p.minTierName}
                  >
                    <Lock size={12} />
                    {p.minTierName}
                  </span>
                )}
              </div>
              <div className="poster-grid__title">{p.title}</div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
