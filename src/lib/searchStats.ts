import type { Payload } from 'payload'
import { sqlRows } from '@/lib/sql'

const MIN_LEN = 2
const MAX_LEN = 200

/** Записать поисковый запрос в лог (fire-and-forget, ошибки не критичны). */
export async function logSearchQuery(payload: Payload, tenantId: number, q: string, results: number): Promise<void> {
  const query = (q || '').trim()
  if (query.length < MIN_LEN || query.length > MAX_LEN) return
  try {
    await sqlRows(payload, `INSERT INTO search_queries (tenant_id, q, results) VALUES ($1, $2, $3)`, [
      tenantId,
      query,
      Number.isFinite(results) ? results : 0,
    ])
  } catch {
    /* лог поиска не критичен */
  }
}

export type SearchStat = { q: string; count: number }
export type SearchStats = { popular: SearchStat[]; recent: string[]; total: number; uniq: number }

/** Агрегаты поиска тенанта за период (дни): популярные, недавние, счётчики. */
export async function getSearchStats(payload: Payload, tenantId: number, days: number): Promise<SearchStats> {
  const popular = await sqlRows<{ q: string; count: number }>(
    payload,
    `SELECT min(q) AS q, count(*)::int AS count
       FROM search_queries
      WHERE tenant_id = $1 AND created_at > now() - ($2 * interval '1 day') AND length(q) >= ${MIN_LEN}
      GROUP BY lower(q)
      ORDER BY count DESC, max(created_at) DESC
      LIMIT 20`,
    [tenantId, days],
  )
  const recentRaw = await sqlRows<{ q: string }>(
    payload,
    `SELECT q FROM search_queries
      WHERE tenant_id = $1 AND length(q) >= ${MIN_LEN}
      ORDER BY created_at DESC
      LIMIT 150`,
    [tenantId],
  )
  const seen = new Set<string>()
  const recent: string[] = []
  for (const r of recentRaw) {
    const k = r.q.toLowerCase()
    if (seen.has(k)) continue
    seen.add(k)
    recent.push(r.q)
    if (recent.length >= 20) break
  }
  const totals = await sqlRows<{ total: number; uniq: number }>(
    payload,
    `SELECT count(*)::int AS total, count(distinct lower(q))::int AS uniq
       FROM search_queries
      WHERE tenant_id = $1 AND created_at > now() - ($2 * interval '1 day') AND length(q) >= ${MIN_LEN}`,
    [tenantId, days],
  )
  return { popular, recent, total: totals[0]?.total || 0, uniq: totals[0]?.uniq || 0 }
}
