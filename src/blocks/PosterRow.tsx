import Image from 'next/image'

/**
 * PosterRow — горизонтальный ряд вертикальных постеров 2:3 (киноблок).
 * Для категорий с posterLayout: заголовок = имя категории (кликабелен, ведёт
 * в категорию), под ним — скроллящийся ряд постеров без подписей.
 *
 * Постеры берут cover в размере `poster` (WebP, из imageSizes Media), с
 * фолбэком на оригинал. Обрезка под 2:3 (object-fit: cover). Пустой ряд не
 * рендерится. Скролл — чистый CSS (свайп/трекпад), без JS.
 */

export type PosterItem = {
  id: string | number
  slug: string
  title: string
  posterUrl: string | null
}

export type PosterRowProps = {
  title: string
  href: string
  items: PosterItem[]
}

export function PosterRow({ title, href, items }: PosterRowProps) {
  if (!items || items.length === 0) return null

  return (
    <section className="poster-row" aria-label={title}>
      <a href={href} className="poster-row__head">
        <h2 className="poster-row__title">{title}</h2>
        <span className="poster-row__more" aria-hidden>
          Все →
        </span>
      </a>

      <div className="poster-row__scroll">
        {items.map((it) => (
          <a
            key={it.id}
            href={`/publication/${it.slug}`}
            className="poster-card"
            title={it.title}
          >
            <div className="poster-card__frame">
              {it.posterUrl ? (
                <Image
                  src={it.posterUrl}
                  alt={it.title}
                  fill
                  sizes="(max-width: 640px) 40vw, 170px"
                  className="poster-card__img"
                />
              ) : (
                <div className="poster-card__placeholder" aria-hidden>
                  {it.title.slice(0, 1).toUpperCase()}
                </div>
              )}
            </div>
          </a>
        ))}
      </div>
    </section>
  )
}
