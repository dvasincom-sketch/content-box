import crypto from 'crypto'
import type { Payload } from 'payload'

/**
 * Внешний API-ключ тенанта (X-API-KEY). Значение не храним — только sha256-хеш
 * в site-settings.externalApiKeyHash. Ключ идентифицирует ТЕНАНТА (роуты /api/*
 * минуют tenant-прокси, поэтому по хосту тенанта не определить).
 */
const KEY_PREFIX = 'cbx_'

export function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update((key || '').trim()).digest('hex')
}

/** Новый ключ: сырое значение (показываем один раз), его хеш и префикс для показа. */
export function generateApiKey(): { key: string; hash: string; prefix: string } {
  const raw = crypto.randomBytes(24).toString('hex') // 48 hex-символов
  const key = KEY_PREFIX + raw
  return { key, hash: hashApiKey(key), prefix: key.slice(0, 12) }
}

export type ExternalApiContext = { tenantId: number; settingsId: number | string }

/**
 * Резолв тенанта по X-API-KEY. Отмечает время последнего использования
 * (fire-and-forget). null — ключ не задан/не найден.
 */
export async function resolveTenantByApiKey(payload: Payload, key: string): Promise<ExternalApiContext | null> {
  const k = (key || '').trim()
  if (!k) return null
  const hash = hashApiKey(k)
  const res = await payload.find({
    collection: 'site-settings',
    where: { externalApiKeyHash: { equals: hash } } as any,
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const s = res.docs[0] as any
  if (!s) return null
  const rawTenant = s.tenant
  const tenantId = Number(rawTenant && typeof rawTenant === 'object' ? rawTenant.id : rawTenant)
  if (!Number.isFinite(tenantId)) return null
  try {
    await payload.update({
      collection: 'site-settings',
      id: s.id,
      data: { externalApiKeyLastUsedAt: new Date().toISOString() } as any,
      overrideAccess: true,
    })
  } catch {
    /* отметка не критична */
  }
  return { tenantId, settingsId: s.id }
}
