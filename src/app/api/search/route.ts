import { NextRequest, NextResponse } from 'next/server'
import { runSearch } from '@/search/query'
import { resolveViewerTenantFromRequest } from '@/search/tenant'
import { rateLimit, clientIp, tooManyRequests } from '@/lib/rateLimit'

export const dynamic = 'force-dynamic'

/**
 * Full search — GET /api/search?q=...&type=publication&category=<id>&page=1&limit=20&locked=1
 * `locked=0` excludes tier-gated content ("Искать в закрытом контенте" toggle OFF).
 * proxy.ts bypasses /api, so the tenant is resolved here from the Host header.
 */
/** Верхняя граница длины запроса: длиннее — это уже не поиск, а нагрузка. */
const MAX_QUERY_LEN = 200

export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams

  // Поиск — единственный публичный роут, который бьёт в Meilisearch на каждый
  // вызов. Лимит щедрый: обычный человек за минуту столько не наберёт.
  const rl = rateLimit(`search:${clientIp(req.headers)}`, 60, 60 * 1000)
  if (!rl.ok) return tooManyRequests(rl.retryAfter)

  const tenant = await resolveViewerTenantFromRequest(req.headers)
  if (!tenant) return NextResponse.json({ error: 'unknown tenant' }, { status: 404 })

  const result = await runSearch({
    tenantId: tenant.id,
    viewerTier: tenant.viewerTier,
    q: (sp.get('q') ?? '').trim().slice(0, MAX_QUERY_LEN),
    type: sp.get('type'),
    category: sp.get('category'),
    page: Number(sp.get('page') ?? '1'),
    limit: Number(sp.get('limit') ?? '20'),
    includeLocked: (sp.get('locked') ?? '1') !== '0',
  })

  return NextResponse.json(result)
}
