import React from 'react'

type Social = { platform?: string | null; url?: string | null }

export type SocialLinksBlockProps = {
  heading?: string
  items: Social[]
}

/**
 * Настоящие цветные иконки соцсетей (бренд-бейджи в стиле app-icon): каждая —
 * самодостаточный SVG с фирменным цветом/градиентом и белым глифом.
 */
const BRAND: Record<string, { label: string; hint: string; Badge: React.FC }> = {
  boosty: {
    label: 'Boosty',
    hint: 'Эксклюзив и ранний доступ',
    Badge: () => (
      <svg viewBox="0 0 24 24" width="46" height="46" aria-hidden>
        <rect width="24" height="24" rx="7" fill="#F15F2C" />
        <path fill="#fff" d="M13.2 4 6.6 13.4h4l-1.4 6.6 7.2-9.9h-4z" />
      </svg>
    ),
  },
  telegram: {
    label: 'Telegram',
    hint: 'Анонсы и новые видео',
    Badge: () => (
      <svg viewBox="0 0 24 24" width="46" height="46" aria-hidden>
        <circle cx="12" cy="12" r="12" fill="#229ED9" />
        <path
          fill="#fff"
          d="M9.5 15.6 9.3 18c.4 0 .5-.2.8-.4l1.9-1.8 3.9 2.9c.7.4 1.2.2 1.4-.7l2.5-11.6c.3-1.1-.4-1.5-1.1-1.3L4.6 10c-1 .4-1 .9-.2 1.2l3.9 1.2 9-5.7c.4-.2.8-.1.5.2z"
        />
      </svg>
    ),
  },
  vk: {
    label: 'VKontakte',
    hint: 'Всё видео проекта',
    Badge: () => (
      <svg viewBox="0 0 24 24" width="46" height="46" aria-hidden>
        <rect width="24" height="24" rx="7" fill="#0077FF" />
        <path
          fill="#fff"
          d="M12.6 16.6c-4.8 0-7.6-3.3-7.7-8.8h2.4c.1 4 1.9 5.7 3.3 6.1V7.8h2.3v3.5c1.4-.2 2.9-1.8 3.4-3.5h2.3c-.4 2.1-2 3.7-3.1 4.3 1.1.6 2.9 2 3.6 4.5h-2.5c-.5-1.7-1.9-3-3.7-3.2v3.2z"
        />
      </svg>
    ),
  },
  youtube: {
    label: 'YouTube',
    hint: 'Новости и шортсы',
    Badge: () => (
      <svg viewBox="0 0 24 24" width="46" height="46" aria-hidden>
        <rect x="1" y="4" width="22" height="16" rx="5" fill="#FF0000" />
        <path fill="#fff" d="M10 8.8v6.4l5.5-3.2z" />
      </svg>
    ),
  },
  instagram: {
    label: 'Instagram',
    hint: 'Бэкстейджи и сторис',
    Badge: () => (
      <svg viewBox="0 0 24 24" width="46" height="46" aria-hidden>
        <defs>
          <linearGradient id="igg" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stopColor="#FEDA75" />
            <stop offset="0.25" stopColor="#FA7E1E" />
            <stop offset="0.5" stopColor="#D62976" />
            <stop offset="0.75" stopColor="#962FBF" />
            <stop offset="1" stopColor="#4F5BD5" />
          </linearGradient>
        </defs>
        <rect width="24" height="24" rx="7" fill="url(#igg)" />
        <rect x="6" y="6" width="12" height="12" rx="4" fill="none" stroke="#fff" strokeWidth="1.8" />
        <circle cx="12" cy="12" r="3" fill="none" stroke="#fff" strokeWidth="1.8" />
        <circle cx="16.3" cy="7.7" r="1.1" fill="#fff" />
      </svg>
    ),
  },
}

export function SocialLinksBlock({ heading = 'Присоединяйся к нашему сообществу', items }: SocialLinksBlockProps) {
  const links = (items ?? []).filter((s) => s.url && s.platform && BRAND[s.platform])
  if (links.length === 0) return null

  return (
    <section className="mt-10">
      <h2 className="text-2xl lg:text-3xl font-bold mb-6" style={{ color: 'var(--brand-text)', fontFamily: 'var(--font-heading)', fontWeight: 'var(--heading-weight)' as any }}>
        {heading}
      </h2>
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        {links.map((s, i) => {
          const m = BRAND[s.platform!]
          const Badge = m.Badge
          return (
            <a
              key={i}
              href={s.url!}
              target="_blank"
              rel="noopener noreferrer"
              className="c-card c-card--interactive c-spotlight p-5 flex flex-col gap-3"
            >
              <span className="social-badge"><Badge /></span>
              <span className="font-semibold" style={{ color: 'var(--brand-text)' }}>{m.label}</span>
              <span className="text-sm" style={{ color: 'var(--brand-muted)' }}>{m.hint}</span>
            </a>
          )
        })}
      </div>
    </section>
  )
}
