'use client'
import { useEffect } from 'react'

// Нейтральный плейсхолдер (мягкий градиент) вместо браузерной иконки
// «сломанный файл». Инлайновый data-URI — не грузится по сети, не может «упасть».
const PLACEHOLDER =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0' stop-color='%23ecebf2'/%3E%3Cstop offset='1' stop-color='%23d7d6df'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='60' height='60' fill='url(%23g)'/%3E%3C/svg%3E"

/**
 * Глобально подменяет битые <img> нейтральным плейсхолдером — чтобы во время
 * сбоев хранилища (например, 503 от S3) картинки не показывали браузерную
 * иконку «сломанный файл». Слушаем error в фазе перехвата (у img он не всплывает).
 * next/image пропускаем (у него есть srcset и своя обработка ошибок).
 */
export default function BrokenImageFallback() {
  useEffect(() => {
    const onErr = (e: Event) => {
      const t = e.target as HTMLImageElement | null
      if (!t || t.tagName !== 'IMG') return
      if (t.dataset.imgFallback) return
      if (t.srcset) return
      const src = t.currentSrc || t.src
      if (!src || src.startsWith('data:')) return
      t.dataset.imgFallback = '1'
      t.src = PLACEHOLDER
    }
    document.addEventListener('error', onErr, true)
    return () => document.removeEventListener('error', onErr, true)
  }, [])
  return null
}
