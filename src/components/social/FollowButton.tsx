'use client'

import React, { useState } from 'react'
import { toggleFollow } from '@/app/(frontend)/social-actions'

/** Кнопка «Подписаться» на аккаунт участника (Фаза 5). */
export function FollowButton({ handle, targetId, initialFollowing }: { handle?: string; targetId?: number | string; initialFollowing: boolean }) {
  const [following, setFollowing] = useState(initialFollowing)
  const [busy, setBusy] = useState(false)
  async function click() {
    if (busy) return
    setBusy(true)
    const prev = following
    setFollowing(!prev)
    const r = await toggleFollow({ handle, targetId })
    if (!r.ok) setFollowing(prev)
    else if (typeof r.following === 'boolean') setFollowing(r.following)
    setBusy(false)
  }
  return (
    <button type="button" onClick={click} className={following ? 'c-btn c-btn--surface' : 'c-btn c-btn--primary'}>
      {following ? 'Вы подписаны' : 'Подписаться'}
    </button>
  )
}
