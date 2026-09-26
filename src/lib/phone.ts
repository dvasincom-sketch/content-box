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

/**
 * Публичная маска телефона: `+7 (***) ***-45-56` — видны только последние
 * 4 цифры. Используется везде, где имя подписчика показывается публично, чтобы
 * не светить номер телефона.
 */
export function maskPhone(input: string): string {
  const d = String(input || '').replace(/\D/g, '')
  if (d.length < 10) return String(input || '')
  const last4 = d.slice(-4)
  return `+7 (***) ***-${last4.slice(0, 2)}-${last4.slice(2)}`
}

/** Похоже ли строка на телефон (для маскировки «снимка» имени). */
export function looksLikePhone(s: string): boolean {
  const str = String(s || '').trim()
  if (!str) return false
  const digits = str.replace(/\D/g, '')
  if (digits.length < 10 || digits.length > 15) return false
  // Только телефонные символы: цифры, пробелы, + ( ) - .
  return /^[+\d][\d\s()\-.]*$/.test(str)
}

/** Строка-имя → если это телефон, вернуть маску; иначе как есть. */
export function maskIfPhone(name: string): string {
  return looksLikePhone(name) ? maskPhone(name) : String(name || '')
}

/**
 * Публичное имя подписчика: псевдоним (заданное отображаемое имя, если это не
 * телефон), иначе замаскированный телефон, иначе @handle, иначе фолбэк.
 */
export function publicSubscriberName(
  sub: { displayName?: string | null; phone?: string | null; handle?: string | null } | null | undefined,
  fallback = 'Участник',
): string {
  const dn = String(sub?.displayName || '').trim()
  if (dn && !looksLikePhone(dn)) return dn.slice(0, 60)
  const phone = String(sub?.phone || '').trim()
  if (phone) return maskPhone(phone)
  if (dn) return maskIfPhone(dn)
  const handle = String(sub?.handle || '').trim()
  if (handle && !looksLikePhone(handle)) return '@' + handle
  return fallback
}

/**
 * Живая маска ввода РФ-номера: любое состояние строки → «+7 900 000 00 00».
 * Берём только цифры, нормализуем код страны (8/7 в начале — это код, не номер)
 * и группируем как 3-3-2-2. Пустая строка → пусто (чтобы показывался плейсхолдер).
 */
export function formatPhoneInput(input: string): string {
  let digits = (input || '').replace(/\D/g, '')
  if (!digits) return ''
  if (digits[0] === '8' || digits[0] === '7') digits = digits.slice(1)
  digits = digits.slice(0, 10)
  const a = digits.slice(0, 3)
  const b = digits.slice(3, 6)
  const c = digits.slice(6, 8)
  const d = digits.slice(8, 10)
  let out = '+7'
  if (a) out += ' ' + a
  if (b) out += ' ' + b
  if (c) out += ' ' + c
  if (d) out += ' ' + d
  return out
}
