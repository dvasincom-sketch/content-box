'use client'

import React, { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from '@/components/AppLink'

export type HeroSlide = {
  id: string | number
  title: string
  coverUrl: string | null
  href: string
  badge?: string
}

/**
 * Карусель новинок в правой колонке hero. Кроссфейд между слайдами,
 * автопрокрутка с паузой на hover (и отключением при prefers-reduced-motion),
 * стрелки, точки-индикаторы, свайп на тач. Каждый слайд ведёт на публикацию.
 */
export function HeroFeaturedSlider({ slides }: { slides: HeroSlide[] }) {
  const [idx, setIdx] = useState(0)
  const [paused, setPaused] = useState(false)
  const touchX = useRef<number | null>(null)
  const n = slides.length

  useEffect(() => {
    if (n <= 1 || paused) return
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const t = setInterval(() => setIdx((i) => (i + 1) % n), 5000)
    return () => clearInterval(t)
  }, [n, paused])

  if (n === 0) return null
  const go = (d: number) => setIdx((i) => (i + d + n) % n)

  const active = slides[idx]

  return (
    <div
      className="relative rounded-[var(--radius-lg)] overflow-hidden flex flex-col"
      style={{ background: 'var(--brand-surface)', boxShadow: 'var(--brand-card-shadow)' }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={(e) => { touchX.current = e.touches[0].clientX }}
      onTouchEnd={(e) => {
        if (touchX.current == null) return
        const dx = e.changedTouches[0].clientX - touchX.current
        if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1)
        touchX.current = null
      }}
      aria-roledescription="carousel"
    >
      {/* Обложка целиком (16:9), без наложенного текста — многие обложки уже
          содержат свой заголовок. Кроссфейд между слайдами. */}
      <Link href={active.href} className="block" aria-label={active.title}>
        <div
          className="relative w-full"
          style={{ aspectRatio: '16 / 9', background: 'linear-gradient(135deg, var(--brand-primary), var(--brand-accent))' }}
        >
          {slides.map((s, i) => (
            s.coverUrl ? (
              <Image
                key={s.id}
                src={s.coverUrl}
                alt=""
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 50vw"
                priority={i === 0}
                style={{ opacity: i === idx ? 1 : 0, transition: 'opacity 0.5s ease' }}
              />
            ) : null
          ))}

          {active.badge && (
            <span
              className="absolute top-3 left-3 z-10 inline-block text-xs font-bold uppercase tracking-wide px-3 py-1 rounded-full"
              style={{ background: 'var(--brand-accent)', color: '#fff' }}
            >
              {active.badge}
            </span>
          )}

          {n > 1 && (
            <div className="absolute top-3 right-3 z-10 flex gap-1.5">
              {slides.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  aria-label={`Слайд ${i + 1}`}
                  aria-current={i === idx}
                  onClick={(e) => { e.preventDefault(); setIdx(i) }}
                  className="h-1.5 rounded-full transition-all"
                  style={{ width: i === idx ? 20 : 8, background: i === idx ? '#fff' : 'rgba(255,255,255,0.6)' }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Заголовок — под изображением, вне обложки. */}
        <div className="p-4 lg:p-5">
          <h2 className="text-lg lg:text-xl font-bold leading-tight" style={{ color: 'var(--brand-text)' }}>
            {active.title}
          </h2>
        </div>
      </Link>
    </div>
  )
}
