'use client'

import React, { useEffect, useState } from 'react'
import { Globe, X } from 'lucide-react'

/**
 * Подсказка для зарубежных / VPN-посетителей: без VPN (или из РФ) видео грузится
 * лучше — российский плеер (Kinescope) не оптимизирован под зарубежные маршруты
 * и VPN добавляет задержку. Рендерится ТОЛЬКО когда сервер уже определил, что
 * посетитель вне РФ (см. geo.ts), — компонент лишь показывает и прячет.
 *
 * Закрытие запоминаем в localStorage (обычное приложение, не артефакт), чтобы не
 * повторять баннер на каждом видео. Ключ версионный — при смене текста покажем
 * снова.
 */
const DISMISS_KEY = 'vpn-video-hint-dismissed-v1'

export function VpnVideoHint() {
  // Изначально скрыт: на SSR и до чтения localStorage не мигаем баннером.
  const [show, setShow] = useState(false)

  useEffect(() => {
    try {
      if (localStorage.getItem(DISMISS_KEY) !== '1') setShow(true)
    } catch {
      setShow(true)
    }
  }, [])

  if (!show) return null

  function dismiss() {
    setShow(false)
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      /* приватный режим — просто не запомним */
    }
  }

  return (
    <div
      role="note"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        marginBottom: 16,
        padding: '12px 14px',
        borderRadius: 14,
        border: '1px solid color-mix(in srgb, var(--brand-primary) 30%, transparent)',
        background: 'color-mix(in srgb, var(--brand-primary) 10%, transparent)',
        color: 'var(--brand-text)',
        fontSize: 14,
        lineHeight: 1.45,
      }}
    >
      <Globe size={18} style={{ flexShrink: 0, marginTop: 1, color: 'var(--brand-primary)' }} />
      <div style={{ flex: 1 }}>
        Похоже, вы заходите из-за рубежа или через VPN. Видео загрузится быстрее и
        стабильнее <strong>без VPN</strong> (или при подключении из России).
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Скрыть подсказку"
        style={{
          flexShrink: 0,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 26,
          height: 26,
          borderRadius: 8,
          color: 'var(--brand-muted)',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        <X size={16} />
      </button>
    </div>
  )
}
