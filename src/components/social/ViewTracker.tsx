'use client'

import { useEffect } from 'react'
import { recordView } from '@/app/(frontend)/social-actions'

/** Незаметный трекер истории (Фаза 5): фиксирует открытие один раз при монтировании.
    Сервер сам проверит логин и historyEnabled — гостю/выключившему ничего не пишется. */
export function ViewTracker({ targetType, targetId, chapterId }: { targetType: 'publication' | 'video' | 'book'; targetId: number | string; chapterId?: number | string }) {
  useEffect(() => {
    recordView({ targetType, targetId, chapterId }).catch(() => {})
  }, [targetType, targetId, chapterId])
  return null
}
