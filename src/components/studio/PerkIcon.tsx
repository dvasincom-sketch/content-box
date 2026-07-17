import React from 'react'

/**
 * Иконки типов плюшек подписки — в стиле студии (монохром, тонкие штрихи 2px,
 * currentColor). Используются и в редакторе плюшек, и на витрине подписки.
 */

export type PerkType = 'included' | 'star' | 'warning' | 'info'

export const PERK_TYPES: { value: PerkType; label: string }[] = [
  { value: 'included', label: 'Входит' },
  { value: 'star', label: 'Особое' },
  { value: 'warning', label: 'Внимание' },
  { value: 'info', label: 'Инфо' },
]

export function PerkIcon({ type, size = 16 }: { type: PerkType; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }

  switch (type) {
    case 'included':
      // галочка в круге
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M8.5 12.5l2.5 2.5 4.5-5" />
        </svg>
      )
    case 'star':
      // звезда
      return (
        <svg {...common}>
          <path d="M12 3l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z" />
        </svg>
      )
    case 'warning':
      // треугольник с восклицанием
      return (
        <svg {...common}>
          <path d="M12 4l9 15.5H3z" />
          <path d="M12 10v4" />
          <path d="M12 17.5v.01" />
        </svg>
      )
    case 'info':
    default:
      // «i» в круге
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v5" />
          <path d="M12 8v.01" />
        </svg>
      )
  }
}
