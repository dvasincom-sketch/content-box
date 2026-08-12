import { NextRequest, NextResponse } from 'next/server'
import { runSearch } from '@/search/query'
import { resolveViewerTenantFromRequest } from '@/search/tenant'
import { rateLimit, clientIp, tooManyRequests } from '@/lib/rateLimit'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { logSearchQuery } from '@/lib/searchStats'

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

  const q = (sp.get('q') ?? '').trim().slice(0, MAX_QUERY_LEN)
  const page = Number(sp.get('page') ?? '1')
  const result = await runSearch({
    tenantId: tenant.id,
    viewerTier: tenant.viewerTier,
    q,
    type: sp.get('type'),
    category: sp.get('category'),
    page,
    limit: Number(sp.get('limit') ?? '20'),
    includeLocked: (sp.get('locked') ?? '1') !== '0',
  })

  // Логируем только первую страницу запроса — чтобы пагинация не удваивала счётчик.
  if (q && page <= 1) {
    try {
      const payload = await getPayload({ config: await config })
      const n = typeof result.totalHits === 'number' ? result.totalHits : 0
      await logSearchQuery(payload, Number(tenant.id), q, n)
    } catch { /* лог не критичен */ }
  }

  return NextResponse.json(result)
}
