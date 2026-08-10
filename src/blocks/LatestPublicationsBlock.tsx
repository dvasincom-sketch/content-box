import Link from '@/components/AppLink'
import React from 'react'
import Image from 'next/image'
import { Lock, MessageCircle, Heart, Video, Images } from 'lucide-react'
import { relativeDayLabel } from '@/lib/relativeDate'
import { HoverPreviewImage } from '@/components/HoverPreviewImage'

export type PublicationCard = {
  id: string | number
  slug: string
  title: string
  publishedAt?: string | null
  minTierName?: string | null
  cover?: { url?: string | null; alt?: string | null } | string | number | null
  /** Автопостер связанного своего видео — обложка, когда своей нет. */
  posterFallback?: string | null
  previewGif?: string | null
  commentCount?: number
  reactionCount?: number
  hasVideo?: boolean
  hasGallery?: boolean
}

export type LatestPublicationsBlockProps = {
  heading?: string
  items: PublicationCard[]
}

function coverUrl(cover: PublicationCard['cover']): string | null {
  if (cover && typeof cover === 'object' && cover.url) return cover.url
  return null
}

export function LatestPublicationsBlock({ heading = 'Последние публикации', items }: LatestPublicationsBlockProps) {
  if (!items || items.length === 0) return null

  return (
    <section className="mt-10">
      {heading && (
        <h2 className="text-2xl lg:text-3xl font-bold mb-6" style={{ color: 'var(--brand-text)', fontFamily: 'var(--font-heading)', fontWeight: 'var(--heading-weight)' as any }}>
          {heading}
        </h2>
      )}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((p) => {
          const badge = relativeDayLabel(p.publishedAt)
          return (
            <article key={p.id} className="c-card c-card--interactive c-spotlight overflow-hidden flex flex-col">
              {/* Обложка — только при наличии картинки; без неё блок не выводим (без градиента) */}
              {(coverUrl(p.cover) || p.posterFallback) && (
                <Link href={`/publication/${p.slug}`} prefetch={false} className="relative block aspect-video">
                  <HoverPreviewImage
                    poster={(coverUrl(p.cover) || p.posterFallback) as string}
                    gif={p.previewGif ?? null}
                    alt={(typeof p.cover === "object" && p.cover?.alt) || p.title}
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                  />
                  {badge && (
                    <span className="absolute top-3 left-3 text-xs font-semibold px-2.5 py-1 rounded-full"
                      style={{ background: 'rgba(0,0,0,0.45)', color: '#fff' }}>
                      {badge}
                    </span>
                  )}
                  {/* Бейдж платной публикации */}
                  {p.minTierName && (
                    <span className="absolute top-3 right-3 inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full"
                      style={{ background: 'rgba(0,0,0,0.55)', color: '#fff', backdropFilter: 'blur(4px)' }}>
                      <Lock size={12} />
                      {p.minTierName}
                    </span>
                  )}
                </Link>
              )}
              <div className="p-5 flex flex-col gap-3 flex-1">
                {/* Без обложки — дата и «замок» уходят в текст */}
                {!(coverUrl(p.cover) || p.posterFallback) && (badge || p.minTierName) && (
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
                  {/* prefetch={false}: секций четыре по 8 карточек, автопрефетч дал бы
                      до 32 RSC-запросов с каждой главной. */}
                  <Link href={`/publication/${p.slug}`} prefetch={false} className="transition-opacity hover:opacity-70">{p.title}</Link>
                </h3>

                {/* Мета: слева счётчики (комменты, реакции), справа — наличие видео/галереи */}
                <div className="mt-auto flex items-center justify-between text-xs"
                  style={{ color: 'var(--brand-muted)' }}>
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
