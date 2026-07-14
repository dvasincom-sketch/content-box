import React from 'react'

/**
 * Логотип «Контент Бокс» для сайдбара админки.
 * Шрифт Play — через var(--font-play). Серверный компонент, без JS.
 */
export default function BrandLogo() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: "Play, sans-serif" }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 9, background: '#7c3aed', color: '#fff', fontWeight: 700, fontSize: 16, flexShrink: 0 }}>
        КБ
      </span>
      <span style={{ fontSize: 19, fontWeight: 700, color: 'var(--theme-text)', letterSpacing: '0.01em' }}>
        Контент Бокс
      </span>
    </div>
  )
}
