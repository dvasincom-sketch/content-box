'use client'

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'

export type PublicGalleryItem = {
  url: string
  width: number | null
  height: number | null
  caption: string
  alt: string
}

/**
 * Публичная витрина галереи: justified grid (строки равной высоты, ширина по
 * пропорциям — как Google Photos / Flickr) на всю ширину контейнера + lightbox.
 *
 * Базовая защита от копирования: отключены контекстное меню и перетаскивание,
 * прозрачный оверлей поверх каждого фото, user-select:none. Это барьер от
 * обычного «правый клик → сохранить», не абсолютная защита (скриншот возможен).
 *
 * Раскладка justified считается на клиенте по ширине контейнера (ResizeObserver).
 * Размеры фото (width/height) приходят с сервера — если их нет, берём 3:2.
 */
export function PublicGallery({ items }: { items: PublicGalleryItem[] }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)
  const [lightbox, setLightbox] = useState<number | null>(null)

  useEffect(() => {
    if (!containerRef.current) return
    const el = containerRef.current
    const update = () => setContainerWidth(el.clientWidth)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const TARGET_ROW_H = 260 // целевая высота строки, px
  const GAP = 8

  // Раскладка в строки: копим фото, пока суммарная ширina (при целевой высоте)
  // не превысит ширину контейнера, затем масштабируем строку по ширине.
  const rows = useMemo(() => {
    if (!containerWidth || items.length === 0) return []
    const ar = (it: PublicGalleryItem) =>
      it.width && it.height ? it.width / it.height : 3 / 2

    const result: { item: PublicGalleryItem; index: number; w: number; h: number }[][] = []
    let row: { item: PublicGalleryItem; index: number; ar: number }[] = []
    let arSum = 0

    items.forEach((item, index) => {
      const a = ar(item)
      row.push({ item, index, ar: a })
      arSum += a
      // ширина строки при целевой высоте
      const rowWidth = arSum * TARGET_ROW_H + (row.length - 1) * GAP
      if (rowWidth >= containerWidth) {
        const h = (containerWidth - (row.length - 1) * GAP) / arSum
        result.push(row.map((r) => ({ item: r.item, index: r.index, w: r.ar * h, h })))
        row = []
        arSum = 0
      }
    })
    // последняя неполная строка — по целевой высоте (не растягиваем на всю ширину)
    if (row.length) {
      result.push(
        row.map((r) => ({ item: r.item, index: r.index, w: r.ar * TARGET_ROW_H, h: TARGET_ROW_H })),
      )
    }
    return result
  }, [items, containerWidth])

  const close = useCallback(() => setLightbox(null), [])
  const prev = useCallback(
    () => setLightbox((i) => (i === null ? null : (i - 1 + items.length) % items.length)),
    [items.length],
  )
  const next = useCallback(
    () => setLightbox((i) => (i === null ? null : (i + 1) % items.length)),
    [items.length],
  )

  useEffect(() => {
    if (lightbox === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      if (e.key === 'ArrowLeft') prev()
      if (e.key === 'ArrowRight') next()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightbox, close, prev, next])

  const noContext = (e: React.MouseEvent) => e.preventDefault()

  if (items.length === 0) return null

  return (
    <div className="cgal" ref={containerRef} onContextMenu={noContext}>
      {rows.map((row, ri) => (
        <div key={ri} className="cgal__row" style={{ gap: `${GAP}px`, marginBottom: `${GAP}px` }}>
          {row.map(({ item, index, w, h }) => (
            <button
              key={index}
              className="cgal__cell"
              style={{ width: `${w}px`, height: `${h}px` }}
              onClick={() => setLightbox(index)}
              aria-label={item.caption || item.alt || `Фото ${index + 1}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.url}
                alt={item.alt || item.caption || ''}
                loading="lazy"
                draggable={false}
                onContextMenu={noContext}
              />
              <span className="cgal__shield" onContextMenu={noContext} aria-hidden />
              {item.caption && <span className="cgal__cap">{item.caption}</span>}
            </button>
          ))}
        </div>
      ))}

      {lightbox !== null && items[lightbox] && (
        <div className="cgal__lb" onClick={close} onContextMenu={noContext}>
          <button className="cgal__lb-close" onClick={close} aria-label="Закрыть">
            <X size={26} />
          </button>
          {items.length > 1 && (
            <button
              className="cgal__lb-nav cgal__lb-prev"
              onClick={(e) => { e.stopPropagation(); prev() }}
              aria-label="Предыдущее"
            >
              <ChevronLeft size={30} />
            </button>
          )}
          <figure className="cgal__lb-fig" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={items[lightbox].url}
              alt={items[lightbox].alt || ''}
              draggable={false}
              onContextMenu={noContext}
            />
            <span className="cgal__lb-shield" onContextMenu={noContext} aria-hidden />
            {items[lightbox].caption && (
              <figcaption className="cgal__lb-cap">{items[lightbox].caption}</figcaption>
            )}
          </figure>
          {items.length > 1 && (
            <button
              className="cgal__lb-nav cgal__lb-next"
              onClick={(e) => { e.stopPropagation(); next() }}
              aria-label="Следующее"
            >
              <ChevronRight size={30} />
            </button>
          )}
          <div className="cgal__lb-counter">{lightbox + 1} / {items.length}</div>
        </div>
      )}
    </div>
  )
}
