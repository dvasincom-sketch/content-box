import { getPayload } from 'payload'
import config from '@payload-config'

export type ResolvedTenant = {
  id: string
  /** Viewer's access tier for gating. 0 = anonymous / free. */
  viewerTier: number
}

/**
 * Resolve tenant + viewer tier for a request.
 *
 * ⚠️ You already resolve host -> tenant in src/proxy.ts. Reuse that here instead
 * of the fallback lookup below, so there's a single source of truth. The viewer
 * tier must come from the session/auth (subscription level), not the request.
 */
export async function resolveTenantByHost(
  host: string,
): Promise<ResolvedTenant | null> {
  const domain = host.split(':')[0].toLowerCase()

  const payload = await getPayload({ config })
  const res = await payload.find({
    collection: 'tenants', // TODO: your tenants collection slug
    where: { domain: { equals: domain } }, // TODO: your domain field
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  const t = res.docs[0]
  if (!t) return null

  return {
    id: String(t.id),
    viewerTier: 0, // TODO: resolve from the authenticated viewer's subscription
  }
}
