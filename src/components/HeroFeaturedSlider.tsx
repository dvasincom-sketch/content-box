'use client'

import React, { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'

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

  return (
    <div
      className="relative rounded-[var(--radius-lg)] overflow-hidden min-h-[340px]"
      style={{ background: 'linear-gradient(135deg, var(--brand-primary), var(--brand-accent))' }}
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
      {slides.map((s, i) => (
        <Link
          key={s.id}
          href={s.href}
          className="absolute inset-0 flex flex-col justify-end p-6 lg:p-8"
          style={{ opacity: i === idx ? 1 : 0, transition: 'opacity 0.5s ease', pointerEvents: i === idx ? 'auto' : 'none' }}
          aria-hidden={i !== idx}
          tabIndex={i === idx ? undefined : -1}
        >
          {s.coverUrl && (
            <Image src={s.coverUrl} alt={s.title} fill className="object-cover" sizes="(max-width: 1024px) 100vw, 50vw" priority={i === 0} />
          )}
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.45) 40%, transparent 75%)' }} />
          <div className="relative">
            {s.badge && (
              <span className="inline-block text-xs font-bold uppercase tracking-wide px-3 py-1 rounded-full mb-3" style={{ background: 'var(--brand-accent)', color: '#fff' }}>
                {s.badge}
              </span>
            )}
            <h2 className="text-2xl lg:text-3xl font-bold text-white leading-tight">{s.title}</h2>
          </div>
        </Link>
      ))}

      {n > 1 && (
        <>
          <div className="absolute top-4 right-6 z-10 flex gap-1.5">
            {slides.map((s, i) => (
              <button key={s.id} type="button" aria-label={`Слайд ${i + 1}`} aria-current={i === idx} onClick={() => setIdx(i)}
                className="h-1.5 rounded-full transition-all"
                style={{ width: i === idx ? 20 : 8, background: i === idx ? '#fff' : 'rgba(255,255,255,0.5)' }} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
