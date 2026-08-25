import React from 'react'

type Social = { platform?: string | null; url?: string | null; description?: string | null }

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
  tiktok: {
    label: 'TikTok',
    hint: 'Короткие видео',
    Badge: () => (
      <svg viewBox="0 0 24 24" width="46" height="46" aria-hidden>
        <rect width="24" height="24" rx="7" fill="#010101" />
        <path fill="#fff" d="M16.5 5.5c.4 1.3 1.3 2.3 2.6 2.6v2.2c-1 0-1.9-.3-2.7-.8v4.7c0 2.4-2 4.3-4.4 4.1-2-.2-3.6-1.9-3.6-4 0-2.3 2-4.1 4.3-4v2.3c-.3-.1-.6-.2-.9-.2-1 0-1.8.9-1.8 1.9s.8 1.9 1.9 1.9 1.9-.8 1.9-1.9V5.5z" />
      </svg>
    ),
  },
  x: {
    label: 'X (Twitter)',
    hint: 'Новости и анонсы',
    Badge: () => (
      <svg viewBox="0 0 24 24" width="46" height="46" aria-hidden>
        <rect width="24" height="24" rx="7" fill="#000" />
        <path fill="#fff" d="M13.9 10.6 19 5h-1.5l-4.3 4.8L9.8 5H5l5.4 7.6L5 19h1.5l4.6-5.2 3.7 5.2H19l-5.1-8.4zm-1.6 1.8-.5-.7-4-5.4h1.9l3 4.1.5.7 4.2 5.7h-1.9l-3.2-4.4z" />
      </svg>
    ),
  },
  facebook: {
    label: 'Facebook',
    hint: 'Новости и сообщество',
    Badge: () => (
      <svg viewBox="0 0 24 24" width="46" height="46" aria-hidden>
        <rect width="24" height="24" rx="7" fill="#1877F2" />
        <path fill="#fff" d="M15.5 8.5h-1.3c-.5 0-.7.3-.7.7V11h2l-.3 2h-1.7v6h-2.3v-6H9.5v-2h1.7V9c0-1.6 1-2.8 2.8-2.8h1.5z" />
      </svg>
    ),
  },
  ok: {
    label: 'Одноклассники',
    hint: 'Новости и общение',
    Badge: () => (
      <svg viewBox="0 0 24 24" width="46" height="46" aria-hidden>
        <rect width="24" height="24" rx="7" fill="#EE8208" />
        <text x="12" y="16" textAnchor="middle" fontFamily="Arial, sans-serif" fontSize="9" fontWeight={700} fill="#fff">OK</text>
      </svg>
    ),
  },
  dzen: {
    label: 'Дзен',
    hint: 'Статьи и видео',
    Badge: () => (
      <svg viewBox="0 0 24 24" width="46" height="46" aria-hidden>
        <rect width="24" height="24" rx="7" fill="#000" />
        <path fill="#fff" d="M12 5c.3 3.2 1.8 4.7 5 5-3.2.3-4.7 1.8-5 5-.3-3.2-1.8-4.7-5-5 3.2-.3 4.7-1.8 5-5z" />
      </svg>
    ),
  },
  rutube: {
    label: 'RUTUBE',
    hint: 'Все видео',
    Badge: () => (
      <svg viewBox="0 0 24 24" width="46" height="46" aria-hidden>
        <rect width="24" height="24" rx="7" fill="#F73B4E" />
        <path fill="#fff" d="M10 8.8v6.4l5.5-3.2z" />
      </svg>
    ),
  },
  twitch: {
    label: 'Twitch',
    hint: 'Прямые эфиры',
    Badge: () => (
      <svg viewBox="0 0 24 24" width="46" height="46" aria-hidden>
        <rect width="24" height="24" rx="7" fill="#9146FF" />
        <path fill="#fff" d="M8 6 6.5 8.5V17H9v2h1.8l2-2H16l2.5-2.5V6zm9.2 8.2L15.5 16h-2.7l-2 2v-2H8.5V7.5h8.7zM14 9.7h-1.2v3.3H14zm3.2 0H16v3.3h1.2z" />
      </svg>
    ),
  },
  discord: {
    label: 'Discord',
    hint: 'Чат сообщества',
    Badge: () => (
      <svg viewBox="0 0 24 24" width="46" height="46" aria-hidden>
        <rect width="24" height="24" rx="7" fill="#5865F2" />
        <path fill="#fff" d="M16.6 8.3c-.9-.4-1.9-.7-2.9-.9l-.2.4c-1-.2-2-.2-3 0l-.2-.4c-1 .2-2 .5-2.9.9-1.9 2.7-2.4 5.4-2.1 8 1.1.8 2.2 1.3 3.3 1.6l.7-1.1c-.4-.1-.8-.3-1.1-.5l.3-.2c2.1 1 4.5 1 6.6 0l.3.2c-.4.2-.7.4-1.1.5l.7 1.1c1.1-.3 2.2-.8 3.3-1.6.3-3-.5-5.7-2-8zM10.2 14c-.6 0-1.1-.6-1.1-1.2s.5-1.2 1.1-1.2 1.1.6 1.1 1.2-.5 1.2-1.1 1.2zm3.6 0c-.6 0-1.1-.6-1.1-1.2s.5-1.2 1.1-1.2 1.1.6 1.1 1.2-.5 1.2-1.1 1.2z" />
      </svg>
    ),
  },
  whatsapp: {
    label: 'WhatsApp',
    hint: 'Канал и общение',
    Badge: () => (
      <svg viewBox="0 0 24 24" width="46" height="46" aria-hidden>
        <rect width="24" height="24" rx="7" fill="#25D366" />
        <path fill="#fff" d="M12 6a6 6 0 0 0-5.1 9.1L6 18l3-.9A6 6 0 1 0 12 6zm3.4 8.3c-.1.4-.8.8-1.1.8-.3 0-.6.1-2-.5-1.7-.7-2.7-2.4-2.8-2.5-.1-.1-.7-.9-.7-1.7s.4-1.2.6-1.4c.1-.1.3-.2.4-.2h.3c.1 0 .3 0 .4.3l.5 1.2c0 .1.1.2 0 .3l-.2.3-.2.2c-.1.1-.2.2-.1.4.1.2.5.8 1.1 1.3.6.6 1.1.8 1.3.9.2.1.3.1.4-.1l.5-.6c.1-.2.3-.1.4-.1l1.2.6c.2.1.3.2.3.2.1.1.1.5 0 .8z" />
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
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {links.map((s, i) => {
          const m = BRAND[s.platform!]
          const Badge = m.Badge
          // Подпись владельца (если задана) → иначе дефолт площадки.
          const hint = (s.description && s.description.trim()) || m.hint
          return (
            <a
              key={i}
              href={s.url!}
              target="_blank"
              rel="noopener noreferrer"
              className="c-card c-card--interactive c-spotlight p-4 flex items-center gap-3"
            >
              <span className="social-badge" style={{ flex: 'none' }}><Badge /></span>
              <span className="flex flex-col min-w-0">
                <span className="font-semibold leading-tight" style={{ color: 'var(--brand-text)' }}>{m.label}</span>
                <span className="text-sm leading-snug" style={{ color: 'var(--brand-muted)' }}>{hint}</span>
              </span>
            </a>
          )
        })}
      </div>
    </section>
  )
}
