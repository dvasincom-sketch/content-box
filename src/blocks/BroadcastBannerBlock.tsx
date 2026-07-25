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
      className="relative overflow-hidden px-8 py-14 mt-16 flex flex-col items-center justify-center text-center rounded-[var(--radius-xl)]"
      style={{
        background: 'var(--glass-2)',
        border: '1px solid var(--brand-border)',
        boxShadow: 'var(--elev-2)',
        backdropFilter: 'blur(var(--glass-blur-2))',
        WebkitBackdropFilter: 'blur(var(--glass-blur-2))',
      }}
    >
      {/* Одно акцентное свечение снизу за текстом — вместо неонового text-shadow */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(60% 120% at 50% 120%, var(--glow-accent), transparent 70%)',
        }}
      />
      <span
        className="relative text-xs font-semibold uppercase tracking-[0.3em] mb-3"
        style={{ color: 'var(--brand-accent)' }}
      >
        {tagline}
      </span>
      <span
        className="relative text-5xl lg:text-7xl font-extrabold tracking-tight"
        style={{
          color: 'var(--brand-text)',
          textShadow:
            '0 0 24px color-mix(in srgb, var(--brand-accent) 45%, transparent)',
        }}
      >
        {onAirText}
      </span>
    </div>
  )
}
