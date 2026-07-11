import React from 'react'
import Link from 'next/link'
import { categoryHref } from '@/lib/categoryHref'

export type TeamMember = {
  photo?: { url?: string | null; alt?: string | null } | string | number | null
  name?: string | null
  category?: { slug?: string | null; breadcrumbs?: { url?: string | null }[] | null } | string | number | null
}

export type HeroTeamBlockProps = {
  members?: TeamMember[]
  caption?: string | null
  avatarSize?: string | null
}

function photoUrl(photo: TeamMember['photo']): string | null {
  if (photo && typeof photo === 'object' && photo.url) return photo.url
  return null
}

/**
 * Блок участников — аватары внахлёст + подпись справа.
 * Данные из SiteSettings.heroTeam (ТЗ §1: брендинг — это данные).
 * Не отображается, если участников нет.
 */
export function HeroTeamBlock({ members = [], caption, avatarSize }: HeroTeamBlockProps) {
  const visible = (members ?? []).filter((m) => photoUrl(m.photo))
  if (visible.length === 0) return null

  const size = Number(avatarSize) || 96
  const overlap = Math.round(size / 4) // наложение — четверть ширины
  const border = size >= 96 ? 3 : 2

  return (
    <section className="mt-10">
      <div className="flex items-center gap-5 flex-wrap">
        <div className="flex items-center">
          {visible.map((member, i) => {
            const url = photoUrl(member.photo)
            const cat = member.category
            const href =
              cat && typeof cat === 'object' ? categoryHref(cat as any) : null

            const wrapStyle: React.CSSProperties = {
              width: `${size}px`,
              height: `${size}px`,
              flexShrink: 0,
              marginLeft: i === 0 ? 0 : `-${overlap}px`,
              borderRadius: '9999px',
              border: `${border}px solid var(--brand-bg)`,
              boxSizing: 'border-box',
              overflow: 'hidden',
              position: 'relative',
              zIndex: visible.length - i,
              display: 'block',
              padding: 0,
              lineHeight: 0,
            }

            const img = (
              <img
                src={url as string}
                alt={member.name || 'Участник'}
                title={member.name || undefined}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: 'block',
                  borderRadius: '9999px',
                }}
              />
            )

            // Аватар без категории — статичный кружок.
            if (!href) {
              return (
                <span key={i} style={wrapStyle}>
                  {img}
                </span>
              )
            }

            return (
              <Link
                key={i}
                href={href}
                aria-label={member.name || 'Участник'}
                className="team-avatar-link transition-transform hover:-translate-y-1"
                style={wrapStyle}
              >
                {img}
              </Link>
            )
          })}
        </div>

        {caption ? (
          <p
            className="text-sm lg:text-base leading-relaxed"
            style={{
              color: 'var(--brand-text)',
              opacity: 0.85,
              whiteSpace: 'pre-line',
              margin: 0,
            }}
          >
            {caption}
          </p>
        ) : null}
      </div>
    </section>
  )
}
