import { NextRequest, NextResponse } from 'next/server'
import { runSuggest } from '@/search/query'
import { resolveViewerTenantFromRequest } from '@/search/tenant'

export const dynamic = 'force-dynamic'

/**
 * Typeahead — GET /api/search/suggest?q=...&locked=1
 * Lightweight dropdown feed. `locked=0` excludes tier-gated content.
 */
export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams
  const q = (sp.get('q') ?? '').trim()
  if (!q) return NextResponse.json({ hits: [] })

  const tenant = await resolveViewerTenantFromRequest(req.headers)
  if (!tenant) return NextResponse.json({ hits: [] })

  const hits = await runSuggest({
    tenantId: tenant.id,
    viewerTier: tenant.viewerTier,
    q,
    includeLocked: (sp.get('locked') ?? '1') !== '0',
  })

  return NextResponse.json({ hits })
}
