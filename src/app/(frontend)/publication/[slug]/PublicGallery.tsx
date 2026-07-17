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

  // Число колонок сетки — адаптивно по ширине контейнера.
  const cols = useMemo(() => {
    if (containerWidth >= 1100) return 4
    if (containerWidth >= 700) return 3
    return 2
  }, [containerWidth])

  // Раскладка. Пропорции у фото часто однородные (кадры из одного видео —
  // все ~16:9), поэтому ритм задаём в основном ПО ПОЗИЦИИ: периодический
  // крупный акцент 2×2, вокруг обычные клетки, изредка широкая 2×1. Экстремальные
  // пропорции (очень высокие/панорамные) всё же учитываем отдельно.
  // grid-auto-flow:dense сам плотно упаковывает разные размеры.
  const tiles = useMemo(() => {
    const ar = (it: PublicGalleryItem) =>
      it.width && it.height ? it.width / it.height : 3 / 2

    // Паттерн акцентов внутри блока из 6 клеток (при 3+ колонках):
    // позиция 0 — большое 2×2, позиция 5 — широкое 2×1, остальные 1×1.
    // Это даёт «крупный акцент + сетка мелких» и повторяется по галерее.
    return items.map((item, index) => {
      const a = ar(item)
      let colSpan = 1
      let rowSpan = 1

      if (cols < 3) {
        // 2 колонки (узкий экран): чередуем большое каждое 5-е
        if (index % 5 === 0) {
          colSpan = 2
          rowSpan = 2
        } else if (a <= 0.7) {
          rowSpan = 2
        }
      } else {
        // 3-4 колонки: паттерн по позиции
        const p = index % 6
        if (a <= 0.62) {
          // реально вертикальное фото — высокое
          rowSpan = 2
        } else if (a >= 2.6) {
          // реально панорамное — широкий акцент
          colSpan = 2
        } else if (p === 0) {
          // крупный акцент
          colSpan = 2
          rowSpan = 2
        } else if (p === 5) {
          // широкая плитка для разбивки ряда
          colSpan = 2
          rowSpan = 1
        }
      }
      return { item, index, colSpan, rowSpan }
    })
  }, [items, cols])

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
    <div
      className="cgal"
      ref={containerRef}
      onContextMenu={noContext}
      style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
    >
      {tiles.map(({ item, index, colSpan, rowSpan }) => (
        <button
          key={index}
          className="cgal__cell"
          style={{ gridColumn: `span ${colSpan}`, gridRow: `span ${rowSpan}` }}
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
