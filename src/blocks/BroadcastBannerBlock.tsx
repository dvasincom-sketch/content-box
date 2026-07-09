import React from 'react'

export type BroadcastBannerBlockProps = {
  onAirText?: string
  tagline?: string
}

/**
 * Неоновый баннер «ON AIR» — финальный блок главной (ТЗ §4.6).
 * Футер вынесен в SiteFooter (layout, на всех страницах).
 */
export function BroadcastBannerBlock({
  onAirText = 'ON AIR',
  tagline = 'BTS TV',
}: BroadcastBannerBlockProps) {
  return (
    <div
      className="relative rounded-3xl overflow-hidden px-8 py-14 mt-16 flex flex-col items-center justify-center text-center"
      style={{
        background:
          'radial-gradient(circle at 50% 120%, color-mix(in srgb, var(--brand-primary) 50%, transparent), #140E24 68%)',
      }}
    >
      <span
        className="text-xs font-semibold uppercase tracking-[0.3em] mb-3"
        style={{ color: 'var(--brand-accent)' }}
      >
        {tagline}
      </span>
      <span
        className="text-5xl lg:text-7xl font-extrabold tracking-tight"
        style={{
          color: '#fff',
          textShadow:
            '0 0 6px var(--brand-accent), 0 0 18px var(--brand-accent), 0 0 40px color-mix(in srgb, var(--brand-accent) 55%, transparent)',
        }}
      >
        {onAirText}
      </span>
    </div>
  )
}
