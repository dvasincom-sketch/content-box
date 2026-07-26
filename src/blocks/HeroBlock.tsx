import React from 'react'
import Link from 'next/link'
import { HeroFeaturedSlider, type HeroSlide } from '@/components/HeroFeaturedSlider'

export type HeroBlockProps = {
  eyebrow?: string
  titleLines: string[]                          // строки заголовка-слогана
  chips?: { title: string; href: string }[]     // категории-чипсы под заголовком
  slides?: HeroSlide[]                           // новинки для карусели справа
}

export function HeroBlock({ eyebrow, titleLines, chips = [], slides = [] }: HeroBlockProps) {
  return (
    <section
      className="grid gap-8 lg:grid-cols-2 lg:gap-12 items-center px-6 py-10 lg:px-10 lg:py-12 rounded-[var(--radius-xl)]"
      style={{ color: 'var(--brand-text)' }}
    >
      {/* Левая колонка — слоган */}
      <div>
        {eyebrow && (
          <span
            className="inline-block text-xs font-semibold uppercase tracking-widest px-3 py-1 rounded-full mb-5"
            style={{ background: 'color-mix(in srgb, var(--brand-primary) 18%, var(--brand-surface))', color: 'var(--brand-primary)', border: '1px solid color-mix(in srgb, var(--brand-primary) 30%, transparent)' }}
          >
            {eyebrow}
          </span>
        )}
        <h1 className="text-4xl lg:text-6xl font-extrabold leading-[1.05] tracking-tight" style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 'var(--heading-weight)' as any }}>
          {titleLines.map((line, i) => (
            <span key={i} className="block">
              {i === titleLines.length - 1 ? (
                <span style={{ background: 'linear-gradient(90deg, var(--brand-primary), var(--brand-accent))', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>
                  {line}
                </span>
              ) : line}
            </span>
          ))}
        </h1>
        {chips.length > 0 && (
          <div className="mt-6 flex flex-wrap gap-2">
            {chips.map((chip) => (
              <Link key={chip.href} href={chip.href} className="pubmeta-chip">
                {chip.title}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Правая колонка — карусель новинок (фолбэк-фон градиент без обложек) */}
      {slides.length > 0 ? (
        <HeroFeaturedSlider slides={slides} />
      ) : (
        <div className="relative rounded-[var(--radius-lg)] overflow-hidden min-h-[340px] flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, var(--brand-primary), var(--brand-accent))' }}>
          <p className="text-white/80">Нет публикаций</p>
        </div>
      )}
    </section>
  )
}
