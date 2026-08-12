/**
 * Короткоживущий подписанный тикет привязки телефона к существующему аккаунту.
 * Выдаётся, когда при регистрации по телефону введён e-mail, который УЖЕ есть в
 * базе: SMS-код на этом шаге уже потрачен, поэтому факт «телефон подтверждён»
 * переносим в тикет (HMAC на payload.secret, TTL 10 мин). Шаг привязки требует
 * тикет + код с почты.
 */
import { createHmac, timingSafeEqual } from 'crypto'

const TTL_MS = 10 * 60 * 1000

export function signLinkTicket(data: { phone: string; email: string }, secret: string): string {
  const body = JSON.stringify({ p: data.phone, e: data.email, x: Date.now() + TTL_MS })
  const payload = Buffer.from(body).toString('base64url')
  const sig = createHmac('sha256', secret).update(payload).digest('base64url')
  return `${payload}.${sig}`
}

export function verifyLinkTicket(token: string, secret: string): { phone: string; email: string } | null {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null
  const [payload, sig] = token.split('.')
  const expected = createHmac('sha256', secret).update(payload).digest('base64url')
  try {
    const a = Buffer.from(sig)
    const b = Buffer.from(expected)
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  } catch { return null }
  let obj: { p?: unknown; e?: unknown; x?: unknown }
  try { obj = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) } catch { return null }
  if (typeof obj?.p !== 'string' || typeof obj?.e !== 'string' || typeof obj?.x !== 'number') return null
  if (Date.now() > obj.x) return null
  return { phone: obj.p, email: obj.e }
}
