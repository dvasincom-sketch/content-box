'use client'

import React, { useState } from 'react'
import { setHistoryEnabled, clearHistory } from '@/app/(frontend)/social-actions'

/** Управление историей просмотров: тумблер + очистка (Фаза 5). */
export function HistorySettings({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled)
  const [busy, setBusy] = useState(false)
  const [cleared, setCleared] = useState(false)

  async function toggle(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.checked
    setEnabled(v)
    await setHistoryEnabled(v)
  }
  async function clear() {
    if (busy) return
    if (!window.confirm('Очистить всю историю просмотров?')) return
    setBusy(true)
    const r = await clearHistory()
    if (r.ok) setCleared(true)
    setBusy(false)
  }

  return (
    <div className="c-card" style={{ padding: 24, marginTop: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ fontWeight: 600, color: 'var(--brand-text)' }}>История просмотров</div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
        <input type="checkbox" checked={enabled} onChange={toggle} />
        <span style={{ color: 'var(--brand-text)' }}>Вести историю просмотров</span>
      </label>
      <div>
        <button className="c-btn c-btn--surface" type="button" onClick={clear} disabled={busy}>Очистить историю</button>
        {cleared && <span style={{ marginLeft: 10, color: 'var(--success)', fontSize: 14 }}>Очищено</span>}
      </div>
    </div>
  )
}
