'use client'

import React, { useEffect, useState } from 'react'
import { X, Mail } from 'lucide-react'
import { EmailCaptureForm } from './EmailCaptureForm'

/**
 * Сквозной баннер для залогиненного подписчика без реального подтверждённого
 * email. Просит указать и подтвердить почту (для еженедельной рассылки и важных
 * уведомлений о профиле). Навязчивый, но не блокирующий: «Позже» скрывает его до
 * конца сессии (sessionStorage) — в следующий визит покажется снова.
 *
 * Рендерится только когда `needsEmail` (синтетический адрес или неподтверждённый).
 */
export function EmailPrompt({
  email,
  verified,
}: {
  /** Реальный email (не синтетический) или null, если не указан. */
  email: string | null
  verified: boolean
}) {
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    // Показываем, если сессия не «отложила». sessionStorage может быть недоступен.
    try {
      if (sessionStorage.getItem('cb-email-prompt-dismissed') === '1') return
    } catch { /* приватный режим */ }
    setOpen(true)
  }, [])

  if (!open) return null

  const hasUnverifiedEmail = Boolean(email) && !verified

  function dismiss() {
    try { sessionStorage.setItem('cb-email-prompt-dismissed', '1') } catch { /* ignore */ }
    setOpen(false)
  }

  return (
    <div
      role="region"
      aria-label="Подтверждение email"
      style={{
        background: 'color-mix(in srgb, var(--brand-primary) 12%, var(--brand-bg))',
        borderBottom: '1px solid color-mix(in srgb, var(--brand-primary) 35%, transparent)',
        color: 'var(--brand-text)',
      }}
    >
      <div className="max-w-6xl mx-auto px-4" style={{ paddingBlock: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Mail size={18} style={{ color: 'var(--brand-primary)', flex: 'none' }} />
          <span style={{ flex: 1, minWidth: 200, fontSize: 14, lineHeight: 1.4 }}>
            {hasUnverifiedEmail ? (
              <>Подтвердите почту <b>{email}</b> — мы отправили письмо со ссылкой. Это нужно для еженедельной рассылки и важных уведомлений о профиле.</>
            ) : (
              <>Укажите email, чтобы получать еженедельную рассылку и важные уведомления о профиле.</>
            )}
          </span>
          {!expanded && (
            <button
              type="button"
              className="c-btn c-btn--primary c-btn--pill c-btn--sm"
              onClick={() => setExpanded(true)}
              style={{ whiteSpace: 'nowrap' }}
            >
              {hasUnverifiedEmail ? 'Изменить / отправить ещё раз' : 'Добавить email'}
            </button>
          )}
          <button
            type="button"
            onClick={dismiss}
            aria-label="Позже"
            title="Напомнить позже"
            className="c-btn c-btn--ghost c-btn--icon c-btn--sm"
            style={{ flex: 'none' }}
          >
            <X size={16} />
          </button>
        </div>
        {expanded && (
          <div style={{ marginTop: 10 }}>
            <EmailCaptureForm initialEmail={email || ''} compact />
          </div>
        )}
      </div>
    </div>
  )
}
