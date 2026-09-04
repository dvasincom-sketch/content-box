import React from 'react'
import Image from 'next/image'

export type CategoryTile = {
  id: string | number
  title: string
  href: string
  cover?: { url?: string | null; alt?: string | null } | string | number | null
}

export type CategoriesGridBlockProps = {
  heading?: string
  items: CategoryTile[]
}

function coverUrl(cover: CategoryTile['cover']): string | null {
  if (cover && typeof cover === 'object' && cover.url) return cover.url
  return null
}

/** Стабильный хеш строки (FNV-1a) → seed цвета. Один и тот же вход даёт один и
 *  тот же оттенок при каждом рендере, поэтому у категории цвет не «прыгает». */
function hashSeed(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/**
 * Псевдослучайный «размытый» цветной фон для плашки без обложки: несколько
 * мягких радиальных цветовых пятен разных оттенков + базовый диагональный
 * градиент. Оттенки детерминированы по seed (id/названию категории), так что у
 * каждой плашки свой стабильный цвет. Плавные переходы дают вид сильно
 * размытого изображения; читаемость белого заголовка обеспечивает тёмный скрим
 * снизу (.c-tile__scrim).
 */
function tileGradient(seed: string): string {
  const h = hashSeed(seed)
  const hue1 = h % 360
  const hue2 = (hue1 + 55 + ((h >> 4) % 90)) % 360
  const hue3 = (hue1 + 180 + ((h >> 8) % 120)) % 360
  return [
    `radial-gradient(120% 110% at 12% 18%, hsl(${hue1} 78% 62%) 0%, transparent 60%)`,
    `radial-gradient(120% 110% at 88% 12%, hsl(${hue2} 80% 58%) 0%, transparent 58%)`,
    `radial-gradient(140% 130% at 72% 96%, hsl(${hue3} 72% 46%) 0%, transparent 62%)`,
    `linear-gradient(135deg, hsl(${hue1} 60% 44%), hsl(${hue2} 58% 38%))`,
  ].join(', ')
}

export function CategoriesGridBlock({ heading = 'Категории', items }: CategoriesGridBlockProps) {
  if (!items || items.length === 0) return null

  return (
    <section className="mt-10">
      <h2 className="text-2xl lg:text-3xl font-bold mb-6" style={{ color: 'var(--brand-text)', fontFamily: 'var(--font-heading)', fontWeight: 'var(--heading-weight)' as any }}>
        {heading}
      </h2>
      <div className="grid gap-5 grid-cols-1 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((c) => {
          const url = coverUrl(c.cover)
          // Без обложки — цветная «размытая» плашка: псевдослучайный мягкий
          // мешевый градиент (стабильный по id/названию) + тёмный скрим снизу +
          // светлый заголовок. Визуально в один ряд с плашками, у которых есть фото.
          if (!url) {
            return (
              <a
                key={c.id}
                href={c.href}
                className="c-tile c-spotlight aspect-[16/6] sm:aspect-[4/3] p-5"
              >
                <div
                  className="absolute inset-0"
                  aria-hidden
                  style={{ background: tileGradient(String(c.id ?? c.title)) }}
                />
                <div className="c-tile__scrim" />
                <h3 className="relative font-semibold text-white text-lg leading-tight">
                  {c.title}
                </h3>
              </a>
            )
          }
          // Есть обложка — афиша с фото и скримом.
          return (
            <a
              key={c.id}
              href={c.href}
              className="c-tile aspect-[16/6] sm:aspect-[4/3] p-5"
            >
              <Image
                src={url}
                alt={(typeof c.cover === 'object' && c.cover?.alt) || c.title}
                fill
                className="object-cover"
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              />
              <div className="c-tile__scrim" />
              <h3 className="relative font-semibold text-white text-lg leading-tight">
                {c.title}
              </h3>
            </a>
          )
        })}
      </div>
    </section>
  )
}
