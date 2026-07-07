import React from 'react'

type Source = { type?: string | null; platform?: string | null; url?: string | null }

export type HeroBlockProps = {
  eyebrow?: string
  titleLines: string[]          // строки заголовка-слогана
  tags?: string[]               // мелкие теги под заголовком
  featured?: {
    title: string
    badge?: string
    sources?: Source[]
  } | null
}

const PLATFORM_LABEL: Record<string, string> = {
  boosty: 'Boosty',
  vk: 'VK Видео',
  telegram: 'Telegram',
  youtube: 'YouTube',
}

export function HeroBlock({ eyebrow, titleLines, tags = [], featured }: HeroBlockProps) {
  const external = (featured?.sources ?? []).filter((s) => s.type === 'external' && s.url)

  return (
    <section
      className="grid gap-8 lg:grid-cols-2 lg:gap-12 items-center px-6 py-10 lg:px-10 lg:py-16 rounded-3xl"
      style={{ background: 'var(--brand-bg)', color: 'var(--brand-text)' }}
    >
      {/* Левая колонка — слоган */}
      <div>
        {eyebrow && (
          <span
            className="inline-block text-xs font-semibold uppercase tracking-widest px-3 py-1 rounded-full mb-5"
            style={{ background: 'color-mix(in srgb, var(--brand-primary) 25%, transparent)', color: 'var(--brand-text)' }}
          >
            {eyebrow}
          </span>
        )}
        <h1 className="text-4xl lg:text-6xl font-extrabold leading-[1.05] tracking-tight">
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
        {tags.length > 0 && (
          <p className="mt-6 text-sm lg:text-base opacity-80">
            {tags.join(' • ')}
          </p>
        )}
      </div>

      {/* Правая колонка — карточка featured с градиентом-заглушкой */}
      <div className="relative rounded-2xl overflow-hidden min-h-[340px] flex flex-col justify-end p-6 lg:p-8"
        style={{
          background: 'linear-gradient(135deg, var(--brand-primary) 0%, var(--brand-accent) 55%, #F59E0B 100%)',
        }}
      >
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.55), transparent 60%)' }} />
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
                    className="text-sm font-semibold px-4 py-2 rounded-lg bg-white/15 hover:bg-white/25 backdrop-blur transition-colors text-white">
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
