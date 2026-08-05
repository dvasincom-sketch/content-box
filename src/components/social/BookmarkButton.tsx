'use client'

import React, { useState } from 'react'
import { Bookmark, BookmarkCheck } from 'lucide-react'
import { toggleBookmark } from '@/app/(frontend)/social-actions'

/** Кнопка «Посмотреть позже» (Фаза 5). Тумблер сохранения публикации/видео. */
export function BookmarkButton({ targetType, targetId, initialSaved }: { targetType: 'publication' | 'video' | 'book'; targetId: number | string; initialSaved: boolean }) {
  const [saved, setSaved] = useState(initialSaved)
  const [busy, setBusy] = useState(false)
  async function click() {
    if (busy) return
    setBusy(true)
    const prev = saved
    setSaved(!prev)
    const r = await toggleBookmark({ targetType, targetId })
    if (!r.ok) setSaved(prev)
    else if (typeof r.saved === 'boolean') setSaved(r.saved)
    setBusy(false)
  }
  return (
    <button type="button" onClick={click} className="c-btn c-btn--surface c-btn--icon c-spotlight" title={saved ? 'В сохранённых — убрать' : 'Сохранить на потом'} aria-pressed={saved}>
      {saved ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}
    </button>
  )
}
