import React from 'react'

/**
 * Брендовый блок над формой входа (admin.components.beforeLogin).
 * Первое, что видит пользователь — название продукта и подпись.
 */
export default function BeforeLogin() {
  return (
    <div style={{ textAlign: 'center', marginBottom: 24, fontFamily: "Play, sans-serif" }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 56, height: 56, borderRadius: 16, background: '#7c3aed', color: '#fff', fontWeight: 700, fontSize: 24, marginBottom: 14 }}>
        КБ
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--theme-text)', marginBottom: 4 }}>
        Контент Бокс
      </div>
      <div style={{ fontSize: 14, color: 'var(--theme-text)', opacity: 0.55 }}>
        Панель управления контентом
      </div>
    </div>
  )
}
