'use client'

import React, { useState } from 'react'
import Image from 'next/image'

/**
 * Обложка карточки с hover-превью: показывает постер, а при наведении плавно
 * проявляет короткий gif (ассет генерит воркер, ключ gifKey). Gif грузится
 * ЛЕНИВО — src проставляется только после первого наведения, чтобы не тянуть
 * десятки гифок при отрисовке ленты. Занимает весь позиционированный родитель
 * (обычно <Link className="relative … aspect-video">); бейджи рисуются поверх
 * как соседи после этого компонента.
 */
export function HoverPreviewImage({
  poster,
  gif,
  alt,
  sizes,
  priority,
}: {
  poster: string
  gif?: string | null
  alt: string
  sizes?: string
  priority?: boolean
}) {
  const [hovered, setHovered] = useState(false)
  const [seen, setSeen] = useState(false) // первый ховер был → gif можно грузить
  const [loaded, setLoaded] = useState(false)

  return (
    <span
      className="absolute inset-0 block"
      onMouseEnter={() => { setHovered(true); setSeen(true) }}
      onMouseLeave={() => setHovered(false)}
    >
      <Image src={poster} alt={alt} fill className="object-cover" sizes={sizes} priority={priority} />
      {gif && seen && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={gif}
          alt=""
          aria-hidden
          onLoad={() => setLoaded(true)}
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-200"
          style={{ opacity: hovered && loaded ? 1 : 0 }}
        />
      )}
    </span>
  )
}
