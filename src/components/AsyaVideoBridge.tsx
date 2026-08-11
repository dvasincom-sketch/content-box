'use client'

import { useEffect } from 'react'
import { setAsyaVideo } from '@/lib/asyaVideo'

/**
 * Регистрирует текущее видео для глобальной кнопки «Спросить Асю» (её заголовок
 * станет «Что в этом видео», а в панели покажется саммари). Сам ничего не
 * рендерит. На размонтировании — очищает.
 */
export function AsyaVideoBridge({ videoId, minPrice }: { videoId: string | number; minPrice: number }) {
  useEffect(() => {
    setAsyaVideo({ id: videoId, minPrice })
    return () => setAsyaVideo(null)
  }, [videoId, minPrice])
  return null
}
