'use client'

import React, { useState } from 'react'
import { Bell, BellRing } from 'lucide-react'
import { toggleBookFollow } from '@/app/(frontend)/social-actions'

/** «Следить за обновлениями книги»: новые главы придут в дайджесте. */
export function FollowBookButton({ bookId, initialFollowing }: { bookId: number | string; initialFollowing: boolean }) {
  const [following, setFollowing] = useState(initialFollowing)
  const [busy, setBusy] = useState(false)
  async function click() {
    if (busy) return
    setBusy(true)
    const prev = following
    setFollowing(!prev)
    const r = await toggleBookFollow({ bookId })
    if (!r.ok) setFollowing(prev)
    else if (typeof r.following === 'boolean') setFollowing(r.following)
    setBusy(false)
  }
  return (
    <button type="button" onClick={click} disabled={busy}
      className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-3 rounded-xl"
      style={{
        background: following ? 'color-mix(in srgb, var(--brand-primary) 16%, transparent)' : 'color-mix(in srgb, var(--brand-text) 8%, transparent)',
        color: 'var(--brand-text)',
      }}
      title={following ? 'Вы следите за обновлениями' : 'Уведомлять о новых главах'}
      aria-pressed={following}
    >
      {following ? <BellRing size={16} /> : <Bell size={16} />}
      {following ? 'Вы следите' : 'Следить'}
    </button>
  )
}
