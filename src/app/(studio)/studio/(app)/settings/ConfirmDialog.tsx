'use client'

import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Loader2, AlertTriangle } from 'lucide-react'

/**
 * Студийная модалка подтверждения (замена window.confirm). Портал в body,
 * поверх всего. danger — красная кнопка действия (удаление).
 */
export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Удалить',
  cancelLabel = 'Отмена',
  danger = true,
  busy = false,
  onConfirm,
  onCancel,
}: {
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const body = (
    <div
      className="studio-portal"
      onClick={() => !busy && onCancel()}
      style={{ position: 'fixed', inset: 0, zIndex: 1200, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
        style={{ width: '100%', maxWidth: 440, background: 'var(--st-surface)', border: '1px solid var(--st-border-strong)', borderRadius: 16, boxShadow: '0 20px 50px rgba(0,0,0,0.4)', padding: 20 }}
      >
        <div style={{ display: 'flex', gap: 12 }}>
          {danger && (
            <span style={{ flexShrink: 0, width: 36, height: 36, borderRadius: 10, display: 'grid', placeItems: 'center', background: 'color-mix(in srgb, var(--st-danger) 14%, transparent)', color: 'var(--st-danger)' }}>
              <AlertTriangle size={18} />
            </span>
          )}
          <div style={{ minWidth: 0 }}>
            {title && <h3 style={{ margin: '2px 0 6px', fontSize: 16, fontWeight: 700, color: 'var(--st-text)' }}>{title}</h3>}
            <p style={{ margin: 0, fontSize: 14, color: 'var(--st-text)', lineHeight: 1.5 }}>{message}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 18 }}>
          <button className="studio-btn studio-btn--ghost" onClick={onCancel} disabled={busy}>{cancelLabel}</button>
          <button
            className="studio-btn"
            onClick={onConfirm}
            disabled={busy}
            style={danger ? { background: 'var(--st-danger)', color: '#fff', border: 'none' } : undefined}
          >
            {busy ? <Loader2 size={16} className="spin" /> : null} {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )

  if (!mounted) return null
  return createPortal(body, document.body)
}
