import React from 'react'

/**
 * Брендовый блок над формой входа — только текст.
 */
export default function BeforeLogin() {
  return (
    <div style={{ textAlign: 'center', marginBottom: 24, fontFamily: 'Play, sans-serif' }}>
      <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--theme-text)', marginBottom: 4 }}>
        Контент Бокс
      </div>
      <div style={{ fontSize: 14, color: 'var(--theme-text)', opacity: 0.55 }}>
        Панель управления контентом
      </div>
    </div>
  )
}
