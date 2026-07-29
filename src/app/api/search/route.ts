import { NextRequest, NextResponse } from 'next/server'
import { runSearch } from '@/search/query'
import { resolveViewerTenantFromRequest } from '@/search/tenant'

export const dynamic = 'force-dynamic'

/**
 * Full search — GET /api/search?q=...&type=publication&category=<id>&page=1&limit=20&locked=1
 * `locked=0` excludes tier-gated content ("Искать в закрытом контенте" toggle OFF).
 * proxy.ts bypasses /api, so the tenant is resolved here from the Host header.
 */
export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams

  const tenant = await resolveViewerTenantFromRequest(req.headers)
  if (!tenant) return NextResponse.json({ error: 'unknown tenant' }, { status: 404 })

  const result = await runSearch({
    tenantId: tenant.id,
    viewerTier: tenant.viewerTier,
    q: (sp.get('q') ?? '').trim(),
    type: sp.get('type'),
    category: sp.get('category'),
    page: Number(sp.get('page') ?? '1'),
    limit: Number(sp.get('limit') ?? '20'),
    includeLocked: (sp.get('locked') ?? '1') !== '0',
  })

  return NextResponse.json(result)
}
