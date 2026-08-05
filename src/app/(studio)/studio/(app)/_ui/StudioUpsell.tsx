import React from 'react'
import Link from 'next/link'
import { Lock } from 'lucide-react'
import { CAP_UPSELL, type Capability } from '@/lib/studioEntitlements'

/** Заглушка-апселл вместо контента раздела, недоступного на текущем тарифе. */
export function StudioUpsell({ cap }: { cap: Capability }) {
  const copy = CAP_UPSELL[cap]
  return (
    <div className="studio-page">
      <div className="studio-card" style={{ padding: 32, maxWidth: 560, margin: '40px auto', textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', width: 56, height: 56, borderRadius: 999, alignItems: 'center', justifyContent: 'center', background: 'var(--st-surface-hover)', marginBottom: 16 }}>
          <Lock size={24} style={{ color: 'var(--st-text-muted)' }} />
        </div>
        <h1 style={{ fontSize: 20, margin: '0 0 8px' }}>{copy.title} — недоступно на текущем тарифе</h1>
        <p style={{ color: 'var(--st-text-muted)', margin: '0 0 20px' }}>{copy.text}</p>
        <Link href="/studio/upgrade" className="studio-btn studio-btn--primary">Оформить пакет</Link>
      </div>
    </div>
  )
}
