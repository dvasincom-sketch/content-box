import React from 'react'
import { Play, Camera, Send, Zap, Users } from 'lucide-react'

type Social = { platform?: string | null; url?: string | null }

export type SocialLinksBlockProps = {
  heading?: string
  items: Social[]
}

const META: Record<string, { label: string; Icon: any; hint: string }> = {
  boosty: { label: 'Boosty', Icon: Zap, hint: 'Эксклюзив и ранний доступ' },
  telegram: { label: 'Telegram', Icon: Send, hint: 'Анонсы и новые видео' },
  vk: { label: 'VKontakte', Icon: Users, hint: 'Всё видео проекта' },
  youtube: { label: 'YouTube', Icon: Play, hint: 'Новости и шортсы' },
  instagram: { label: 'Instagram', Icon: Camera, hint: 'Бэкстейджи и сторис' },
}

export function SocialLinksBlock({ heading = 'Присоединяйся к нашему сообществу', items }: SocialLinksBlockProps) {
  const links = (items ?? []).filter((s) => s.url && s.platform && META[s.platform])
  if (links.length === 0) return null

  return (
    <section className="mt-14">
      <h2 className="text-2xl lg:text-3xl font-bold mb-6" style={{ color: 'var(--brand-text)', fontFamily: 'var(--font-heading)', fontWeight: 'var(--heading-weight)' as any }}>
        {heading}
      </h2>
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        {links.map((s, i) => {
          const m = META[s.platform!]
          const Icon = m.Icon
          return (
            
            <a
              key={i}
              href={s.url!}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-2xl p-5 flex flex-col gap-3 transition-transform hover:-translate-y-1"
              style={{ background: 'var(--brand-surface)' }}
            >
              <span
                className="inline-flex items-center justify-center w-11 h-11 rounded-xl"
                style={{ background: 'color-mix(in srgb, var(--brand-primary) 25%, transparent)', color: 'var(--brand-primary)' }}
              >
                <Icon size={22} strokeWidth={2} />
              </span>
              <span className="font-semibold" style={{ color: 'var(--brand-text)' }}>{m.label}</span>
              <span className="text-sm" style={{ color: 'var(--brand-text)', opacity: 0.7 }}>{m.hint}</span>
            </a>
          )
        })}
      </div>
    </section>
  )
}
