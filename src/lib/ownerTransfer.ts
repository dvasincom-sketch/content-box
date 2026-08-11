/**
 * In-memory состояние ожидающей передачи прав владельца (кому передаём), пока
 * владелец подтверждает код с почты. Живёт рядом с OTP (otpStore): single-
 * instance контейнер Timeweb, TTL 5 минут, потеря при редеплое допустима.
 * Ключ — `${tenantId}:${ownerId}`.
 */
const TTL_MS = 5 * 60 * 1000
type Pending = { targetId: string; expiresAt: number }
const store = new Map<string, Pending>()
const key = (tenantId: string, ownerId: string) => `${tenantId}:${ownerId}`

export function setPendingTransfer(tenantId: string, ownerId: string, targetId: string): void {
  store.set(key(tenantId, ownerId), { targetId, expiresAt: Date.now() + TTL_MS })
}
export function getPendingTransfer(tenantId: string, ownerId: string): string | null {
  const e = store.get(key(tenantId, ownerId))
  if (!e) return null
  if (Date.now() > e.expiresAt) { store.delete(key(tenantId, ownerId)); return null }
  return e.targetId
}
export function clearPendingTransfer(tenantId: string, ownerId: string): void {
  store.delete(key(tenantId, ownerId))
}
