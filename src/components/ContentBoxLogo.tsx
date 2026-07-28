import React from 'react'

/**
 * Официальный логотип платформы «Контент Бокс» (знак из landing.html / brandbook).
 * Знак и подпись используют currentColor → логотип сам подстраивается под тему:
 * тёмный на светлой, светлый на тёмной. «Бокс» — в моно-шрифте IBM Plex Mono,
 * как в брендбуке (класс logo__mono, var(--mono)).
 */
export function ContentBoxLogo({ size = 26 }: { size?: number }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        color: 'var(--brand-text)',
        fontWeight: 600,
        fontSize: 16,
        letterSpacing: '-0.01em',
        lineHeight: 1,
      }}
    >
      <svg
        viewBox="0 0 52 52"
        width={size}
        height={size}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        style={{ flexShrink: 0 }}
      >
        <g transform="translate(26 26)">
          <path d="M-16 -16 H16 V0 L0 16 H-16 Z" fill="currentColor" opacity="0.9" />
          <path
            d="M16 -16 V16 H-16 L16 -16 Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
        </g>
      </svg>
      <span>
        Контент{' '}
        <span
          style={{ fontFamily: "'IBM Plex Mono', ui-monospace, Menlo, monospace", fontWeight: 500 }}
        >
          Бокс
        </span>
      </span>
    </span>
  )
}
