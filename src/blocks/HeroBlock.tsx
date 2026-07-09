import React from 'react'
import Image from 'next/image'
import Link from 'next/link'

type Source = { type?: string | null; platform?: string | null; url?: string | null }

export type HeroBlockProps = {
  eyebrow?: string
  titleLines: string[]          // строки заголовка-слогана
  chips?: { title: string; slug: string }[]   // категории-чипсы под заголовком
  featured?: {
    title: string
    badge?: string
    sources?: Source[]
    cover?: { url?: string | null; alt?: string | null } | string | number | null
  } | null
}

const PLATFORM_LABEL: Record<string, string> = {
  boosty: 'Boosty',
  vk: 'VK Видео',
  telegram: 'Telegram',
  youtube: 'YouTube',
}

function coverUrl(cover: unknown): string | null {
  if (cover && typeof cover === 'object' && 'url' in cover && (cover as any).url) {
    return (cover as any).url
  }
  return null
}

export function HeroBlock({ eyebrow, titleLines, chips = [], featured }: HeroBlockProps) {
  const external = (featured?.sources ?? []).filter((s) => s.type === 'external' && s.url)

  return (
    <section
      className="grid gap-8 lg:grid-cols-2 lg:gap-12 items-center px-6 py-10 lg:px-10 lg:py-12 rounded-3xl"
      style={{ background: 'var(--brand-bg)', color: 'var(--brand-text)' }}
    >
      {/* Левая колонка — слоган */}
      <div>
        {eyebrow && (
          <span
            className="inline-block text-xs font-semibold uppercase tracking-widest px-3 py-1 rounded-full mb-5"
            style={{ background: 'color-mix(in srgb, var(--brand-primary) 18%, var(--brand-surface))', color: 'var(--brand-primary)', border: '1px solid color-mix(in srgb, var(--brand-primary) 30%, transparent)' }}
          >
            {eyebrow}
          </span>
        )}
        <h1 className="text-4xl lg:text-6xl font-extrabold leading-[1.05] tracking-tight" style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 'var(--heading-weight)' as any }}>
          {titleLines.map((line, i) => (
            <span key={i} className="block">
              {i === titleLines.length - 1 ? (
                <span style={{
                  background: 'linear-gradient(90deg, var(--brand-primary), var(--brand-accent))',
                  WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
                }}>
                  {line}
                </span>
              ) : line}
            </span>
          ))}
        </h1>
        {chips.length > 0 && (
          <div className="mt-6 flex flex-wrap gap-2">
            {chips.map((chip) => (
              <Link
                key={chip.slug}
                href={`/category/${chip.slug}`}
                className="text-sm px-3.5 py-1.5 rounded-full transition-colors"
                style={{
                  color: 'var(--brand-text)',
                  background: 'color-mix(in srgb, var(--brand-primary) 12%, transparent)',
                  border: '1px solid color-mix(in srgb, var(--brand-primary) 30%, transparent)',
                }}
              >
                {chip.title}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Правая колонка — карточка featured; градиент — фолбэк без обложки */}
      <div className="relative rounded-2xl overflow-hidden min-h-[340px] flex flex-col justify-end p-6 lg:p-8"
        style={{
          background: 'linear-gradient(135deg, var(--brand-primary) 0%, var(--brand-accent) 55%, #F59E0B 100%)',
        }}
      >
        {coverUrl(featured?.cover) && (
          <Image
            src={coverUrl(featured?.cover) as string}
            alt={featured?.title || ''}
            fill
            className="object-cover"
            sizes="(max-width: 1024px) 100vw, 50vw"
            priority
          />
        )}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.45) 40%, transparent 75%)' }} />
        {featured ? (
          <div className="relative">
            {featured.badge && (
              <span className="inline-block text-xs font-bold uppercase tracking-wide px-3 py-1 rounded-full mb-3"
                style={{ background: 'var(--brand-accent)', color: '#fff' }}>
                {featured.badge}
              </span>
            )}
            <h2 className="text-2xl lg:text-3xl font-bold text-white leading-tight mb-5">
              {featured.title}
            </h2>
            {external.length > 0 && (
              <div className="flex flex-wrap gap-3">
                {external.map((s, i) => (
                  <a key={i} href={s.url!} target="_blank" rel="noopener noreferrer"
                    className="text-sm font-semibold px-4 py-2 rounded-lg bg-white/15 hover:bg-white/25 backdrop-blur transition-colors"
                style={{ color: '#fff' }}>
                    {PLATFORM_LABEL[s.platform ?? ''] ?? s.platform}
                  </a>
                ))}
              </div>
            )}
          </div>
        ) : (
          <p className="relative text-white/80">Нет featured-публикации</p>
        )}
      </div>
    </section>
  )
}
