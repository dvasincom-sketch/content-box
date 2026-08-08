/**
 * In-memory одноразовые коды входа по телефону.
 *
 * Timeweb запускает один долгоживущий контейнер (`next start`), поэтому
 * module-level Map переживает запросы и достаточен для single-instance.
 * Коды короткоживущие (TTL 5 мин), потеря при редеплое допустима.
 * Ключ — `${tenantId}:${phone}` (нормализованный 7XXXXXXXXXX).
 */
import { createHash, randomInt, timingSafeEqual } from 'crypto'

const TTL_MS = 5 * 60 * 1000
const RESEND_COOLDOWN_MS = 60 * 1000 // не чаще раза в минуту
const MAX_ATTEMPTS = 5 // попыток ввода одного кода
const WINDOW_MS = 60 * 60 * 1000 // окно анти-флуда
const MAX_PER_WINDOW = 5 // не более N кодов за час на номер

type Entry = { hash: string; expiresAt: number; attempts: number; sentAt: number }
const store = new Map<string, Entry>()
const history = new Map<string, number[]>()

function key(tenantId: string, phone: string) {
  return `${tenantId}:${phone}`
}
function hashCode(code: string, salt: string) {
  return createHash('sha256').update(`${salt}:${code}`).digest('hex')
}

export type IssueResult =
  | { ok: true; code: string }
  | { ok: false; reason: 'cooldown' | 'flood'; retryAfterSec: number }

export function issueCode(tenantId: string, phone: string, salt: string): IssueResult {
  const k = key(tenantId, phone)
  const now = Date.now()
  const existing = store.get(k)
  if (existing && now - existing.sentAt < RESEND_COOLDOWN_MS) {
    return { ok: false, reason: 'cooldown', retryAfterSec: Math.ceil((RESEND_COOLDOWN_MS - (now - existing.sentAt)) / 1000) }
  }
  const hist = (history.get(k) || []).filter((t) => now - t < WINDOW_MS)
  if (hist.length >= MAX_PER_WINDOW) {
    return { ok: false, reason: 'flood', retryAfterSec: Math.ceil((WINDOW_MS - (now - hist[0])) / 1000) }
  }
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0')
  store.set(k, { hash: hashCode(code, salt), expiresAt: now + TTL_MS, attempts: 0, sentAt: now })
  hist.push(now)
  history.set(k, hist)
  return { ok: true, code }
}

export type VerifyResult = 'ok' | 'invalid' | 'expired' | 'too_many'
export function verifyCode(tenantId: string, phone: string, code: string, salt: string): VerifyResult {
  const k = key(tenantId, phone)
  const e = store.get(k)
  if (!e) return 'expired'
  if (Date.now() > e.expiresAt) {
    store.delete(k)
    return 'expired'
  }
  if (e.attempts >= MAX_ATTEMPTS) {
    store.delete(k)
    return 'too_many'
  }
  e.attempts += 1
  const a = Buffer.from(e.hash)
  const b = Buffer.from(hashCode(code, salt))
  const match = a.length === b.length && timingSafeEqual(a, b)
  if (!match) return 'invalid'
  store.delete(k)
  return 'ok'
}
