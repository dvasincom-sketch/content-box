import Link from '@/components/AppLink'
import React from 'react'
import Image from 'next/image'
import { Lock, MessageCircle, Heart, Video, Images } from 'lucide-react'
import { relativeDayLabel } from '@/lib/relativeDate'
import type { PublicationCard } from './LatestPublicationsBlock'
import { HoverPreviewImage } from '@/components/HoverPreviewImage'

/**
 * CarouselBlock — кураторская карусель: один горизонтально прокручиваемый ряд
 * карточек публикаций из источника секции (авто/категория/тег/ручной список).
 *
 * Отличается от LatestPublicationsBlock раскладкой: не сетка 4-в-ряд, а лента
 * фиксированной ширины карточек со scroll-snap (свайп/трекпад, без JS). Даёт
 * «подборку» — витрину под конкретную категорию или ручной набор.
 *
 * Пустой список не рендерится (авто-скрытие как у остальных секций).
 */

export type CarouselBlockProps = {
  heading?: string
  items: PublicationCard[]
}

function coverUrl(cover: PublicationCard['cover']): string | null {
  if (cover && typeof cover === 'object' && cover.url) return cover.url
  return null
}

export function CarouselBlock({ heading = 'Подборка', items }: CarouselBlockProps) {
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

      <div className="home-carousel">
        {items.map((p) => {
          const badge = relativeDayLabel(p.publishedAt)
          const url = coverUrl(p.cover) || p.posterFallback || null
          return (
            <article
              key={p.id}
              className="home-carousel__card c-card c-card--interactive c-spotlight overflow-hidden flex flex-col"
            >
              {url && (
                <div className="relative h-40">
                  <HoverPreviewImage
                    poster={url}
                    gif={p.previewGif ?? null}
                    alt={(typeof p.cover === 'object' && p.cover?.alt) || p.title}
                    sizes="280px"
                  />
                  {badge && (
                    <span
                      className="absolute top-3 left-3 text-xs font-semibold px-2.5 py-1 rounded-full"
                      style={{ background: 'rgba(0,0,0,0.45)', color: '#fff' }}
                    >
                      {badge}
                    </span>
                  )}
                  {p.minTierName && (
                    <span
                      className="absolute top-3 right-3 inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full"
                      style={{ background: 'rgba(0,0,0,0.55)', color: '#fff', backdropFilter: 'blur(4px)' }}
                    >
                      <Lock size={12} />
                      {p.minTierName}
                    </span>
                  )}
                </div>
              )}
              <div className="p-4 flex flex-col gap-3 flex-1">
                {!url && (badge || p.minTierName) && (
                  <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--brand-muted)' }}>
                    {badge && <span>{badge}</span>}
                    {p.minTierName && (
                      <span className="inline-flex items-center gap-1">
                        <Lock size={12} />
                        {p.minTierName}
                      </span>
                    )}
                  </div>
                )}
                <h3 className="font-semibold leading-snug" style={{ color: 'var(--brand-text)' }}>
                  <Link
                    href={`/publication/${p.slug}`}
                    prefetch={false}
                    className="transition-opacity hover:opacity-70"
                  >
                    {p.title}
                  </Link>
                </h3>
                <div
                  className="mt-auto flex items-center justify-between text-xs"
                  style={{ color: 'var(--brand-muted)' }}
                >
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center gap-1" title="Комментарии">
                      <MessageCircle size={14} />
                      <span style={{ fontVariantNumeric: 'tabular-nums' }}>{p.commentCount ?? 0}</span>
                    </span>
                    <span className="inline-flex items-center gap-1" title="Реакции">
                      <Heart size={14} />
                      <span style={{ fontVariantNumeric: 'tabular-nums' }}>{p.reactionCount ?? 0}</span>
                    </span>
                  </div>
                  {(p.hasVideo || p.hasGallery) && (
                    <div className="flex items-center gap-2.5">
                      {p.hasVideo && (
                        <span className="inline-flex items-center" title="Есть видео">
                          <Video size={14} />
                        </span>
                      )}
                      {p.hasGallery && (
                        <span className="inline-flex items-center" title="Есть галерея">
                          <Images size={14} />
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
