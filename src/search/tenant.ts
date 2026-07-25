import { headers as nextHeaders } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'
import { stripPort, subdomainFromHost } from '@/lib/subdomain'

export type ViewerTenant = {
  id: string
  /** Access weight of the current viewer. 0 = anonymous / free. */
  viewerTier: number
}

/**
 * Resolve an ACTIVE + domainVerified tenant by host, mirroring proxy.ts
 * (subdomain first, then custom domain). Used by the /api/search routes, which
 * proxy.ts bypasses (so they don't get x-tenant-id and must resolve themselves).
 */
async function tenantIdByHost(host: string): Promise<string | null> {
  const h = stripPort(host)
  if (!h) return null
  const sub = subdomainFromHost(h)
  const payload = await getPayload({ config })

  const where = sub
    ? {
        and: [
          { subdomain: { equals: sub } },
          { status: { equals: 'active' } },
          { domainVerified: { equals: true } },
        ],
      }
    : {
        and: [
          { domain: { equals: h } },
          { status: { equals: 'active' } },
          { domainVerified: { equals: true } },
        ],
      }

  const res = await payload.find({
    collection: 'tenants',
    where,
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  return res.docs[0] ? String(res.docs[0].id) : null
}

/**
 * Resolve the current tenant + viewer tier.
 *  - Frontend (SSR) requests carry `x-tenant-id` from proxy.ts -> use it directly.
 *  - API routes don't (proxy bypasses /api) -> resolve by Host header.
 *
 * TODO: viewerTier is 0 (anonymous) for now. Wire the logged-in subscriber's
 * active tier weight here to unlock gated content for paying viewers.
 */
export async function resolveViewerTenant(
  reqHeaders?: Headers,
): Promise<ViewerTenant | null> {
  const hdrs = reqHeaders ?? (await nextHeaders())

  const fromProxy = hdrs.get('x-tenant-id')
  if (fromProxy) return { id: fromProxy, viewerTier: 0 }

  const host =
    hdrs.get('x-forwarded-host') ?? hdrs.get('host') ?? ''
  const id = await tenantIdByHost(host)
  return id ? { id, viewerTier: 0 } : null
}
