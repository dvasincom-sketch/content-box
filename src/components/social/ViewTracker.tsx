'use client'

import { useEffect } from 'react'
import { recordView } from '@/app/(frontend)/social-actions'

/** Незаметный трекер истории (Фаза 5): фиксирует открытие один раз при монтировании.
    Сервер сам проверит логин и historyEnabled — гостю/выключившему ничего не пишется. */
export function ViewTracker({ targetType, targetId }: { targetType: 'publication' | 'video'; targetId: number | string }) {
  useEffect(() => {
    recordView({ targetType, targetId }).catch(() => {})
  }, [targetType, targetId])
  return null
}
