import type { CSSProperties } from 'react'

/**
 * Общие инлайн-стили форм авторизации подписчика (/login и /register).
 *
 * Раньше оба файла держали побайтово одинаковые объекты стилей (карточка,
 * заголовок, label, input, кнопка, ошибка, нижняя ссылка). Вынесены сюда, чтобы
 * не расходились. Цвета — на бренд-токенах тенанта (`--brand-*`).
 */

export const authCardStyle: CSSProperties = {
  maxWidth: 420,
  margin: '64px auto',
  padding: '32px 28px',
  borderRadius: 16,
  background: 'color-mix(in srgb, var(--brand-surface) 40%, transparent)',
  border: '1px solid color-mix(in srgb, var(--brand-text) 10%, transparent)',
}

export const authHeadingStyle: CSSProperties = {
  marginBottom: 24,
  fontSize: 28,
  color: 'var(--brand-text)',
}

export const authLabelStyle: CSSProperties = {
  display: 'block',
  marginBottom: 16,
  fontSize: 14,
  fontWeight: 500,
}

export const authInputStyle: CSSProperties = {
  display: 'block',
  width: '100%',
  marginTop: 6,
  padding: '11px 14px',
  fontSize: 15,
  color: 'var(--brand-text)',
  background: 'color-mix(in srgb, var(--brand-surface) 50%, transparent)',
  border: '1px solid color-mix(in srgb, var(--brand-text) 20%, transparent)',
  borderRadius: 10,
  boxSizing: 'border-box',
}

export const authButtonStyle: CSSProperties = {
  width: '100%',
  marginTop: 8,
  padding: '12px',
  fontSize: 15,
  fontWeight: 600,
  color: '#fff',
  background: 'var(--brand-primary)',
  border: 'none',
  borderRadius: 10,
  cursor: 'pointer',
}

export const authErrorStyle: CSSProperties = {
  color: '#c00',
  fontSize: 14,
  marginTop: 8,
}

export const authAltLinkStyle: CSSProperties = {
  marginTop: 16,
  fontSize: 14,
}
