'use client'

import React, { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle } from 'lucide-react'

/**
 * ConfirmDialog — переиспользуемое окно подтверждения студии.
 * Замена браузерного window.confirm единым стилем дизайн-системы.
 *
 * Портал в body + .studio-portal: вызывается из любых контейнеров, включая
 * те, где предок создаёт stacking-контекст (backdrop-filter/transform) и
 * position:fixed съезжает. Закрытие по оверлею и Escape.
 *
 * Пример:
 *   const [confirm, setConfirm] = useState<null | {...}>(null)
 *   {confirm && <ConfirmDialog {...confirm} onCancel={() => setConfirm(null)} />}
 */
export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Подтвердить',
  cancelLabel = 'Отмена',
  danger = false,
  onConfirm,
  onCancel,
}: {
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  const [mounted, setMounted] = React.useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Escape закрывает, Enter подтверждает.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel()
      if (e.key === 'Enter') onConfirm()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onConfirm, onCancel])

  const dialog = (
    <div className="studio-portal">
      <div className="confirm__overlay" onClick={onCancel}>
        <div
          className="confirm"
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="confirm__body">
            {danger && (
              <span className="confirm__icon confirm__icon--danger">
                <AlertTriangle size={20} />
              </span>
            )}
            <div className="confirm__text">
              <h3 className="confirm__title">{title}</h3>
              {message && <p className="confirm__message">{message}</p>}
            </div>
          </div>
          <div className="confirm__foot">
            <button className="studio-btn studio-btn--ghost" onClick={onCancel}>
              {cancelLabel}
            </button>
            <button
              className={
                'studio-btn ' + (danger ? 'studio-btn--danger' : 'studio-btn--primary')
              }
              onClick={onConfirm}
              autoFocus
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  if (!mounted) return null
  return createPortal(dialog, document.body)
}
