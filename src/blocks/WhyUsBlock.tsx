import React from 'react'
import { Mic, MonitorPlay, Clock, Heart, Globe, Library, Zap, CalendarDays } from 'lucide-react'

type Advantage = {
  icon: 'mic' | 'screen' | 'clock' | 'heart' | 'globe' | 'library' | 'zap' | 'calendar'
  title: string
  text: string
}

export type WhyUsBlockProps = {
  heading?: string
  items: Advantage[]
}

const ICONS = {
  mic: Mic,
  screen: MonitorPlay,
  clock: Clock,
  heart: Heart,
  globe: Globe,
  library: Library,
  zap: Zap,
  calendar: CalendarDays,
}

export function WhyUsBlock({ heading = 'Почему мы', items }: WhyUsBlockProps) {
  if (!items || items.length === 0) return null

  return (
    <section className="mt-10">
      <h2 className="text-2xl lg:text-3xl font-bold mb-6" style={{ color: 'var(--brand-text)', fontFamily: 'var(--font-heading)', fontWeight: 'var(--heading-weight)' as any }}>
        {heading}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((a, i) => {
          const Icon = ICONS[a.icon]
          return (
            <div
              key={i}
              className="c-card c-spotlight p-5 flex flex-col gap-3"
            >
              <span className="c-icon-chip">
                <Icon size={22} strokeWidth={2} />
              </span>
              <h3 className="font-semibold text-lg leading-tight" style={{ color: 'var(--brand-text)' }}>
                {a.title}
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--brand-muted)' }}>
                {a.text}
              </p>
            </div>
          )
        })}
      </div>
    </section>
  )
}
