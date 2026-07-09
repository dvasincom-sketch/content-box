import React from 'react'
import Image from 'next/image'
import { relativeDayLabel } from '@/lib/relativeDate'

type Source = { type?: string | null; platform?: string | null; url?: string | null }

export type PublicationCard = {
  id: string | number
  slug: string
  title: string
  publishedAt?: string | null
  sources?: Source[] | null
  cover?: { url?: string | null; alt?: string | null } | string | number | null
}

export type LatestPublicationsBlockProps = {
  heading?: string
  items: PublicationCard[]
}

const PLATFORM_LABEL: Record<string, string> = {
  boosty: 'Boosty', vk: 'VK', telegram: 'Telegram', youtube: 'YouTube',
}

function coverUrl(cover: PublicationCard['cover']): string | null {
  if (cover && typeof cover === 'object' && cover.url) return cover.url
  return null
}

export function LatestPublicationsBlock({ heading = 'Последние публикации', items }: LatestPublicationsBlockProps) {
  if (!items || items.length === 0) return null

  return (
    <section className="mt-14">
      <h2 className="text-2xl lg:text-3xl font-bold mb-6" style={{ color: 'var(--brand-text)', fontFamily: 'var(--font-heading)', fontWeight: 'var(--heading-weight)' as any }}>
        {heading}
      </h2>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((p) => {
          const badge = relativeDayLabel(p.publishedAt)
          const external = (p.sources ?? []).filter((s) => s.type === 'external' && s.url)
          return (
            <article key={p.id} className="rounded-2xl overflow-hidden flex flex-col"
              style={{ background: 'var(--brand-surface)' }}>
              {/* Обложка публикации; градиент — фолбэк, если cover не задан */}
              <div className="relative h-36"
                style={{ background: 'linear-gradient(135deg, var(--brand-primary), var(--brand-accent))' }}>
                {coverUrl(p.cover) && (
                  <Image
                    src={coverUrl(p.cover) as string}
                    alt={(typeof p.cover === 'object' && p.cover?.alt) || p.title}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                  />
                )}
                {badge && (
                  <span className="absolute top-3 left-3 text-xs font-semibold px-2.5 py-1 rounded-full"
                    style={{ background: 'rgba(0,0,0,0.45)', color: '#fff' }}>
                    {badge}
                  </span>
                )}
              </div>
              <div className="p-4 flex flex-col gap-3 flex-1">
                <h3 className="font-semibold leading-snug" style={{ color: 'var(--brand-text)' }}>
                  <a href={`/publication/${p.slug}`} className="transition-opacity hover:opacity-70">{p.title}</a>
                </h3>
                {external.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-auto">
                    {external.map((s, i) => (
                      <a key={i} href={s.url!} target="_blank" rel="noopener noreferrer"
                        className="text-xs font-medium px-2.5 py-1 rounded-md transition-colors"
                        style={{ background: 'color-mix(in srgb, var(--brand-primary) 20%, transparent)', color: 'var(--brand-text)' }}>
                        {PLATFORM_LABEL[s.platform ?? ''] ?? s.platform}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
