'use client'

import { useEffect } from 'react'

/**
 * Глобальный «спотлайт»: один слушатель курсора на весь документ. Для любого
 * элемента с классом `.c-spotlight` под курсором пишет координаты мыши в CSS-
 * переменные `--mx/--my` (относительно самого элемента). Радиальный градиент в
 * `.c-spotlight::before` (styles.css) читает их и рисует свечение под курсором —
 * как на meilisearch.com.
 *
 * Почему глобально, а не на каждом компоненте: не нужно делать клиентскими
 * десятки серверных блоков — достаточно повесить класс. Обновление идёт через
 * requestAnimationFrame (не чаще кадра) и пишет стиль прямо в DOM, без ре-рендера.
 *
 * Монтируется один раз в layout. Ничего не рендерит.
 */
export function SpotlightController() {
  useEffect(() => {
    let raf = 0
    let el: HTMLElement | null = null
    let x = 0
    let y = 0

    const apply = () => {
      raf = 0
      if (!el) return
      const r = el.getBoundingClientRect()
      el.style.setProperty('--mx', `${x - r.left}px`)
      el.style.setProperty('--my', `${y - r.top}px`)
    }

    const onMove = (e: PointerEvent) => {
      const hit = (e.target as Element | null)?.closest?.('.c-spotlight') as HTMLElement | null
      if (!hit) return
      el = hit
      x = e.clientX
      y = e.clientY
      if (!raf) raf = requestAnimationFrame(apply)
    }

    window.addEventListener('pointermove', onMove, { passive: true })
    return () => {
      window.removeEventListener('pointermove', onMove)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  return null
}
