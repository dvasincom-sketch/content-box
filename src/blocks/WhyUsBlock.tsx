import React from 'react'
import { Mic, MonitorPlay, Clock, Heart } from 'lucide-react'

type Advantage = {
  icon: 'mic' | 'screen' | 'clock' | 'heart'
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
}

export function WhyUsBlock({ heading = 'Почему мы', items }: WhyUsBlockProps) {
  if (!items || items.length === 0) return null

  return (
    <section className="mt-14">
      <h2 className="text-2xl lg:text-3xl font-bold mb-6" style={{ color: 'var(--brand-text)' }}>
        {heading}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((a, i) => {
          const Icon = ICONS[a.icon]
          return (
            <div
              key={i}
              className="rounded-2xl p-5 flex flex-col gap-3"
              style={{ background: 'var(--brand-surface)' }}
            >
              <span
                className="inline-flex items-center justify-center w-11 h-11 rounded-xl"
                style={{ background: 'color-mix(in srgb, var(--brand-primary) 25%, transparent)', color: 'var(--brand-primary)' }}
              >
                <Icon size={22} strokeWidth={2} />
              </span>
              <h3 className="font-semibold text-lg leading-tight" style={{ color: 'var(--brand-text)' }}>
                {a.title}
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--brand-text)', opacity: 0.7 }}>
                {a.text}
              </p>
            </div>
          )
        })}
      </div>
    </section>
  )
}
