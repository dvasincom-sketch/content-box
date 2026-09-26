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

export type ReserveResult = { ok: true } | { ok: false; reason: 'cooldown' | 'flood'; retryAfterSec: number }

/**
 * Резервирование слота под код БЕЗ генерации — для подтверждения по звонку,
 * где код (последние цифры номера) присылает провайдер. Проверяет анти-флуд и
 * кулдаун, ставит запись-заглушку (пустой hash) и отмечает отправку, чтобы
 * повторный запрос упёрся в кулдаун. Код проставляется затем через `setCode`.
 */
export function reserveCode(tenantId: string, phone: string): ReserveResult {
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
  store.set(k, { hash: '', expiresAt: now + TTL_MS, attempts: 0, sentAt: now })
  hist.push(now)
  history.set(k, hist)
  return { ok: true }
}

/** Проставить код в зарезервированный слот (после успешного звонка провайдера). */
export function setCode(tenantId: string, phone: string, salt: string, code: string): void {
  const k = key(tenantId, phone)
  const now = Date.now()
  const e = store.get(k)
  const sentAt = e ? e.sentAt : now
  store.set(k, { hash: hashCode(code, salt), expiresAt: now + TTL_MS, attempts: 0, sentAt })
}

/** Снять резерв (если звонок не удался) — чтобы кулдаун не блокировал повтор. */
export function clearCode(tenantId: string, phone: string): void {
  store.delete(key(tenantId, phone))
}

/* ── callcheck: авторизация звонком ОТ клиента ──────────────────────────────
   Между запросом номера (callcheck/add) и опросом статуса нужно помнить
   check_id по паре (tenant, phone). TTL — как у кода. */
const CHECK_TTL_MS = 10 * 60 * 1000
type CheckEntry = { checkId: string; expiresAt: number }
const checkStore = new Map<string, CheckEntry>()

export function setCheckId(tenantId: string, phone: string, checkId: string): void {
  checkStore.set(key(tenantId, phone), { checkId, expiresAt: Date.now() + CHECK_TTL_MS })
}
export function getCheckId(tenantId: string, phone: string): string | null {
  const e = checkStore.get(key(tenantId, phone))
  if (!e) return null
  if (Date.now() > e.expiresAt) { checkStore.delete(key(tenantId, phone)); return null }
  return e.checkId
}
export function clearCheckId(tenantId: string, phone: string): void {
  checkStore.delete(key(tenantId, phone))
}

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
