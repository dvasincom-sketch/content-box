import React from 'react'
import AppLink from '@/components/AppLink'
import { ImageIcon, ArrowRight } from 'lucide-react'

export type PhotoShowcaseBlockProps = {
  imageUrl: string
  alt: string
  folderTitle: string
  folderSlug: string
  heading?: string | null
  count?: number
}

/**
 * «Фото на весь экран» — полноэкранная витрина из папки галереи. Full-bleed
 * (выходит за контейнер главной), снизу — градиент, заголовок и кнопка перехода
 * в галерею папки (/gallery/<slug>). Изображение приходит из page.tsx (случайное
 * фото выбранной папки). Секция самоскрывается, если фото нет.
 */
export function PhotoShowcaseBlock({ imageUrl, alt, folderTitle, folderSlug, heading, count }: PhotoShowcaseBlockProps) {
  if (!imageUrl) return null
  const title = heading || folderTitle
  return (
    <section className="photoshow" aria-label={title}>
      <div className="photoshow__img" style={{ backgroundImage: `url(${imageUrl})` }} role="img" aria-label={alt || title} />
      <div className="photoshow__grad" />
      <div className="photoshow__inner">
        <h2 className="photoshow__title">{title}</h2>
        <AppLink href={`/gallery/${folderSlug}`} className="c-btn c-btn--primary c-btn--pill photoshow__btn">
          <ImageIcon size={16} />
          Смотреть галерею
          {typeof count === 'number' && count > 0 ? <span className="photoshow__count">{count}</span> : null}
          <ArrowRight size={16} />
        </AppLink>
      </div>
    </section>
  )
}
