import React from 'react'

export type TeamMember = {
  photo?: { url?: string | null; alt?: string | null } | string | number | null
  name?: string | null
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
            return (
              <img
                key={i}
                src={url as string}
                alt={member.name || 'Участник'}
                title={member.name || undefined}
                className="rounded-full object-cover"
                style={{
                  width: `${size}px`,
                  height: `${size}px`,
                  marginLeft: i === 0 ? 0 : `-${overlap}px`,
                  border: `${border}px solid var(--brand-bg)`,
                  zIndex: visible.length - i,
                  position: 'relative',
                }}
              />
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
