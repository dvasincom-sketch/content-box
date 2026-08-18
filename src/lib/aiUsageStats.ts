import type { Payload } from 'payload'

/**
 * Статистика использования Аси по тенанту для вкладки «AI» в настройках:
 * вызовы и токены за всё время и за 30 дней, разбивка по трём поверхностям,
 * плюс дневной ряд токенов за 30 дней для мини-графика. Всё SQL-агрегатами
 * через пул БД; ошибки не роняют страницу настроек. Токены пока оценочные.
 */
export type AiSurfaceKey = 'compose' | 'summary' | 'support'

export interface AiSurfaceStat {
  calls: number
  tokens: number
  calls30: number
  tokens30: number
}

export interface AiUsageStats {
  estimated: boolean
  total: AiSurfaceStat
  bySurface: Record<AiSurfaceKey, AiSurfaceStat>
  series: { day: string; tokens: number }[]
}

type PoolLike = { query: (text: string, params: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }> }

const EMPTY = (): AiSurfaceStat => ({ calls: 0, tokens: 0, calls30: 0, tokens30: 0 })
const SURFACES: AiSurfaceKey[] = ['compose', 'summary', 'support']

export async function getAiUsageStats(payload: Payload, tenantId: number | string): Promise<AiUsageStats | null> {
  const pool = (payload.db as unknown as { pool?: PoolLike }).pool
  if (!pool || typeof pool.query !== 'function') return null

  try {
    const bySurface: Record<AiSurfaceKey, AiSurfaceStat> = { compose: EMPTY(), summary: EMPTY(), support: EMPTY() }
    const total = EMPTY()

    const agg = await pool.query(
      `SELECT surface,
         COUNT(*)::int AS calls,
         COALESCE(SUM(tokens_total),0)::bigint AS tokens,
         COUNT(*) FILTER (WHERE created_at >= now() - interval '30 days')::int AS calls30,
         COALESCE(SUM(tokens_total) FILTER (WHERE created_at >= now() - interval '30 days'),0)::bigint AS tokens30
       FROM ai_usage WHERE tenant_id = $1 GROUP BY surface`,
      [tenantId],
    )
    for (const r of agg.rows) {
      const key = String(r.surface) as AiSurfaceKey
      if (!SURFACES.includes(key)) continue
      const stat: AiSurfaceStat = {
        calls: Number(r.calls) || 0,
        tokens: Number(r.tokens) || 0,
        calls30: Number(r.calls30) || 0,
        tokens30: Number(r.tokens30) || 0,
      }
      bySurface[key] = stat
      total.calls += stat.calls
      total.tokens += stat.tokens
      total.calls30 += stat.calls30
      total.tokens30 += stat.tokens30
    }

    const est = await pool.query(`SELECT bool_and(estimated) AS all_est FROM ai_usage WHERE tenant_id = $1`, [tenantId])
    const estimated = est.rows[0]?.all_est !== false // пусто/null → считаем оценкой

    const ser = await pool.query(
      `SELECT to_char(date_trunc('day', created_at),'YYYY-MM-DD') AS day,
         COALESCE(SUM(tokens_total),0)::bigint AS tokens
       FROM ai_usage WHERE tenant_id = $1 AND created_at >= now() - interval '30 days'
       GROUP BY 1 ORDER BY 1`,
      [tenantId],
    )
    const series = ser.rows.map((r) => ({ day: String(r.day), tokens: Number(r.tokens) || 0 }))

    return { estimated, total, bySurface, series }
  } catch {
    return null
  }
}
