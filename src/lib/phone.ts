/**
 * Нормализация и валидация РФ-номеров для SMS-входа.
 * Приводим к каноничному виду `7XXXXXXXXXX` (11 цифр, без «+»), пригодному
 * для sms.ru и как стабильный идентификатор подписчика.
 */
export function normalizePhone(input: string): string | null {
  const digits = (input || '').replace(/\D/g, '')
  if (!digits) return null
  let d = digits
  if (d.length === 11 && d.startsWith('8')) d = '7' + d.slice(1) // 8XXXXXXXXXX → 7XXXXXXXXXX
  if (d.length === 10) d = '7' + d // XXXXXXXXXX → 7XXXXXXXXXX
  if (d.length === 11 && d.startsWith('7')) return d
  return null
}

/** Красивый показ номера: +7 (XXX) XXX-XX-XX. */
export function formatPhone(normalized: string): string {
  const d = normalizePhone(normalized)
  if (!d) return normalized
  const p = d.slice(1)
  return `+7 (${p.slice(0, 3)}) ${p.slice(3, 6)}-${p.slice(6, 8)}-${p.slice(8, 10)}`
}
