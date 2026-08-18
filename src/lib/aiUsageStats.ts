import type { Payload } from 'payload'
import { costRub } from '@/lib/aiPricing'

/**
 * Статистика и стоимость использования Аси по тенанту для подраздела «AI» во
 * вкладке «Тариф»: токены вход/исход и их стоимость — всего, по трём поверхностям
 * и помесячно (для биллинга + списания с депозита). Токены оценочные → стоимость
 * тоже оценка. Всё SQL-агрегатами через пул БД; ошибки не роняют страницу.
 */
export type AiSurfaceKey = 'compose' | 'summary' | 'support'

export interface AiSurfaceStat {
  calls: number
  tokensIn: number
  tokensOut: number
  costRub: number
}
export interface AiMonthStat {
  month: string // YYYY-MM
  calls: number
  tokensIn: number
  tokensOut: number
  costRub: number
}
export interface AiUsageStats {
  estimated: boolean
  totals: AiSurfaceStat
  bySurface: Record<AiSurfaceKey, AiSurfaceStat>
  months: AiMonthStat[] // по возрастанию месяца
}

type PoolLike = { query: (text: string, params: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }> }

const SURFACES: AiSurfaceKey[] = ['compose', 'summary', 'support']
const emptyStat = (): AiSurfaceStat => ({ calls: 0, tokensIn: 0, tokensOut: 0, costRub: 0 })

export async function getAiUsageStats(payload: Payload, tenantId: number | string): Promise<AiUsageStats | null> {
  const pool = (payload.db as unknown as { pool?: PoolLike }).pool
  if (!pool || typeof pool.query !== 'function') return null

  try {
    const bySurface: Record<AiSurfaceKey, AiSurfaceStat> = { compose: emptyStat(), summary: emptyStat(), support: emptyStat() }
    const totals = emptyStat()

    const agg = await pool.query(
      `SELECT surface,
         COUNT(*)::int AS calls,
         COALESCE(SUM(tokens_in),0)::bigint AS tin,
         COALESCE(SUM(tokens_out),0)::bigint AS tout
       FROM ai_usage WHERE tenant_id = $1 GROUP BY surface`,
      [tenantId],
    )
    for (const r of agg.rows) {
      const key = String(r.surface) as AiSurfaceKey
      if (!SURFACES.includes(key)) continue
      const tin = Number(r.tin) || 0
      const tout = Number(r.tout) || 0
      const stat: AiSurfaceStat = { calls: Number(r.calls) || 0, tokensIn: tin, tokensOut: tout, costRub: costRub(tin, tout) }
      bySurface[key] = stat
      totals.calls += stat.calls
      totals.tokensIn += tin
      totals.tokensOut += tout
    }
    totals.costRub = costRub(totals.tokensIn, totals.tokensOut)

    const est = await pool.query(`SELECT bool_and(estimated) AS all_est FROM ai_usage WHERE tenant_id = $1`, [tenantId])
    const estimated = est.rows[0]?.all_est !== false

    const mres = await pool.query(
      `SELECT to_char(date_trunc('month', created_at),'YYYY-MM') AS month,
         COUNT(*)::int AS calls,
         COALESCE(SUM(tokens_in),0)::bigint AS tin,
         COALESCE(SUM(tokens_out),0)::bigint AS tout
       FROM ai_usage WHERE tenant_id = $1
       GROUP BY 1 ORDER BY 1 ASC LIMIT 36`,
      [tenantId],
    )
    const months: AiMonthStat[] = mres.rows.map((r) => {
      const tin = Number(r.tin) || 0
      const tout = Number(r.tout) || 0
      return { month: String(r.month), calls: Number(r.calls) || 0, tokensIn: tin, tokensOut: tout, costRub: costRub(tin, tout) }
    })

    return { estimated, totals, bySurface, months }
  } catch {
    return null
  }
}
