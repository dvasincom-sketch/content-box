'use client'
import React, { useState } from 'react'
import Link from 'next/link'
import { X, UserCog } from 'lucide-react'
import { isSyntheticEmail } from '@/lib/authEmail'

/**
 * Мягкое напоминание при входе в студию: если у автора не заполнено имя или
 * e-mail (синтетический), предлагаем заполнить профиль. Пропускаемое (в рамках
 * загрузки страницы), не блокирует работу.
 */
export function ProfileCompletePrompt({ name, email }: { name: string; email: string }) {
  const needName = !name.trim()
  const needEmail = isSyntheticEmail(email)
  const [dismissed, setDismissed] = useState(false)
  if ((!needName && !needEmail) || dismissed) return null
  const missing = [needName ? 'имя' : null, needEmail ? 'e-mail' : null].filter(Boolean).join(' и ')
  return (
    <div
      style={{
        margin: '0 0 16px', padding: '12px 14px', borderRadius: 12,
        background: 'color-mix(in srgb, var(--st-accent) 12%, transparent)',
        border: '1px solid color-mix(in srgb, var(--st-accent) 30%, transparent)',
        display: 'flex', alignItems: 'center', gap: 12, fontSize: 14, color: 'var(--st-text)',
      }}
    >
      <UserCog size={18} style={{ flex: 'none', color: 'var(--st-accent)' }} />
      <span style={{ flex: 1 }}>Заполните профиль: укажите {missing} — для уведомлений и восстановления доступа.</span>
      <Link href="/studio/profile" className="studio-btn studio-btn--primary" style={{ flex: 'none' }}>Заполнить</Link>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Скрыть"
        style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--st-text-muted)', display: 'grid', placeItems: 'center', padding: 2, flex: 'none' }}
      >
        <X size={16} />
      </button>
    </div>
  )
}
