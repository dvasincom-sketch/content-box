import React from 'react'
import Image from 'next/image'
import Link from '@/components/AppLink'
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
      <style>{`.team-avatar-row::-webkit-scrollbar{display:none}@media (min-width:1024px){.team-avatar-row{overflow:visible;flex-shrink:0}}`}</style>
      <div className="max-w-2xl mx-auto flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-5">
        <div
          className="team-avatar-row flex items-center overflow-x-auto"
          style={{
            // Вынос на края экрана, чтобы скролл шёл «от края до края» на мобиле.
            paddingBlock: 4,
            // Немного правого запаса, чтобы последняя аватарка не липла к краю при скролле.
            paddingInlineEnd: overlap,
            // iOS-инерция + скрытие скроллбара (вместе с CSS ниже).
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >
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
              <Image
                src={url as string}
                alt={member.name || 'Участник'}
                fill
                sizes={`${size}px`}
                style={{ objectFit: 'cover', borderRadius: '9999px' }}
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
