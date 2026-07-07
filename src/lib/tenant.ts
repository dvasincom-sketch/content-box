import { headers as getHeaders } from 'next/headers.js'
import { getPayload } from 'payload'
import config from '@/payload.config'

/**
 * Reads x-tenant-id injected by proxy.ts and loads the tenant + its
 * SiteSettings via Payload Local API. Server components only.
 * overrideAccess:true — isolation is guaranteed by filtering on the
 * proxy-resolved tenant id, not by user access here.
 */
export async function getTenantFromHeaders() {
  const headers = await getHeaders()
  const tenantId = headers.get('x-tenant-id')
  if (!tenantId) return null

  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })

  const tenant = await payload.findByID({
    collection: 'tenants',
    id: tenantId,
    depth: 0,
    overrideAccess: true,
  }).catch(() => null)
  if (!tenant) return null

  const settingsRes = await payload.find({
    collection: 'site-settings',
    where: { tenant: { equals: tenantId } },
    depth: 1,
    limit: 1,
    overrideAccess: true,
  })

  return { tenant, settings: settingsRes.docs[0] ?? null }
}
