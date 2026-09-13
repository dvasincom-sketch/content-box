/**
 * «Запомнить устройство»: подписанный HMAC-куки, чтобы не слать SMS при
 * повторном входе с того же браузера в течение 30 дней. Куки связывает
 * (tenantId, phone, subscriberId); при валидности логиним без кода.
 */
import { createHmac, timingSafeEqual } from 'crypto'

export const TRUSTED_COOKIE = 'cb_td'
export const TRUSTED_MAX_AGE_SEC = 30 * 24 * 60 * 60

function secret() {
  return process.env.PAYLOAD_SECRET || 'dev-secret'
}

export function signTrusted(tenantId: string, phone: string, subscriberId: string): string {
  const exp = Date.now() + TRUSTED_MAX_AGE_SEC * 1000
  const payload = `${tenantId}.${phone}.${subscriberId}.${exp}`
  const sig = createHmac('sha256', secret()).update(payload).digest('base64url')
  return `${Buffer.from(payload).toString('base64url')}.${sig}`
}

/**
 * Разобрать и проверить куки доверенного устройства БЕЗ знания телефона:
 * сверяем подпись, тенант и срок, а телефон и id подписчика достаём из тела.
 * Нужно, чтобы на /login предложить «войти под запомненным аккаунтом» —
 * телефон при этом берём как раз из куки, пользователю его вводить не нужно.
 */
export function readTrusted(
  token: string | undefined,
  tenantId: string,
): { phone: string; subscriberId: string } | null {
  if (!token) return null
  const [body, sig] = token.split('.')
  if (!body || !sig) return null
  let payload: string
  try {
    payload = Buffer.from(body, 'base64url').toString('utf8')
  } catch {
    return null
  }
  const expected = createHmac('sha256', secret()).update(payload).digest('base64url')
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  const [tId, ph, subId, expStr] = payload.split('.')
  if (tId !== tenantId) return null
  if (!expStr || Date.now() > Number(expStr)) return null
  if (!ph || !subId) return null
  return { phone: ph, subscriberId: subId }
}

export function verifyTrusted(token: string | undefined, tenantId: string, phone: string): string | null {
  const r = readTrusted(token, tenantId)
  if (!r || r.phone !== phone) return null
  return r.subscriberId
}
