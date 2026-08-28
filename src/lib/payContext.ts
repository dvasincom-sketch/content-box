import { getPayload, type Payload } from 'payload'
import config from '@/payload.config'
import { tenantIdFromRequestHeaders } from '@/lib/tenantByHost'

/**
 * Контекст тенанта для роутов оплаты под /api/*. ВАЖНО: на /api/* нет заголовка
 * x-tenant-id (proxy.ts их не обрабатывает), поэтому getTenantFromHeaders() там
 * возвращает null. Резолвим тенанта строго ПО ХОСТУ запроса и грузим настройки
 * с overrideAccess (нужен секрет ЮKassa). tenantId используем и для
 * getCurrentSubscriber(tenantId) — иначе он тоже не увидит вошедшего.
 */
export async function resolvePayContext(
  req: Request,
): Promise<{ payload: Payload; tenantId: string; tenant: any; settings: any } | null> {
  const payload = await getPayload({ config: await config })
  const tenantId = await tenantIdFromRequestHeaders(req.headers)
  if (!tenantId) return null
  const tenant = await payload.findByID({ collection: 'tenants', id: tenantId, depth: 0, overrideAccess: true }).catch(() => null)
  if (!tenant) return null
  const sres = await payload
    .find({ collection: 'site-settings', where: { tenant: { equals: tenantId } }, limit: 1, depth: 0, overrideAccess: true })
    .catch(() => ({ docs: [] as any[] }))
  return { payload, tenantId, tenant, settings: sres.docs[0] ?? null }
}
