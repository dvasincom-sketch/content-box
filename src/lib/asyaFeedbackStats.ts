import type { Payload } from 'payload'
import { sqlRows } from '@/lib/sql'

/**
 * Обратная связь по Асе для экрана «Аналитика → Ася»: агрегаты (всего вопросов,
 * с найденными видео / без, 👍 / 👎) + лента последних диалогов. Всё — прямым
 * SQL по `asya_questions` (GROUP BY / FILTER Local API не умеет).
 */
export type AsyaRating = 'up' | 'down' | null
export type AsyaFilter = 'all' | 'down' | 'nomatch'

export interface AsyaMatch {
  title: string | null
  url: string | null
  source: string
}
export interface AsyaFeedbackRow {
  id: number
  question: string
  answer: string
  matches: AsyaMatch[]
  hadMatches: boolean
  rating: AsyaRating
  createdAt: string
  sub: { displayName?: string | null; phone?: string | null; handle?: string | null }
}
export interface AsyaFeedbackStats {
  total: number
  withMatches: number
  noMatches: number
  up: number
  down: number
  rows: AsyaFeedbackRow[]
}

const num = (v: unknown): number => Number(v) || 0

export async function getAsyaFeedbackStats(
  payload: Payload,
  tenantId: number | string,
  filter: AsyaFilter = 'all',
  limit = 100,
): Promise<AsyaFeedbackStats | null> {
  try {
    const [totals] = await sqlRows<{
      total: number; with_matches: number; no_matches: number; up: number; down: number
    }>(
      payload,
      `SELECT
         COUNT(*)::int                                      AS total,
         COUNT(*) FILTER (WHERE had_matches)::int           AS with_matches,
         COUNT(*) FILTER (WHERE NOT had_matches)::int       AS no_matches,
         COUNT(*) FILTER (WHERE rating = 'up')::int         AS up,
         COUNT(*) FILTER (WHERE rating = 'down')::int       AS down
       FROM asya_questions WHERE tenant_id = $1`,
      [tenantId],
    )

    const cond =
      filter === 'down' ? `AND a.rating = 'down'` : filter === 'nomatch' ? `AND a.had_matches = false` : ''
    const lim = Math.max(1, Math.min(300, limit))
    const rowsRaw = await sqlRows<any>(
      payload,
      `SELECT a.id, a.question, a.answer, a.matches, a.had_matches, a.rating, a.created_at,
              s.display_name, s.phone, s.handle
         FROM asya_questions a
         LEFT JOIN subscribers s ON s.id = a.subscriber_id
        WHERE a.tenant_id = $1 ${cond}
        ORDER BY a.created_at DESC
        LIMIT ${lim}`,
      [tenantId],
    )

    const rows: AsyaFeedbackRow[] = rowsRaw.map((r) => ({
      id: num(r.id),
      question: String(r.question || ''),
      answer: String(r.answer || ''),
      matches: Array.isArray(r.matches)
        ? (r.matches as any[]).map((m) => ({ title: m?.title ?? null, url: m?.url ?? null, source: String(m?.source || '') }))
        : [],
      hadMatches: r.had_matches === true,
      rating: r.rating === 'up' ? 'up' : r.rating === 'down' ? 'down' : null,
      createdAt: String(r.created_at || ''),
      sub: { displayName: r.display_name ?? null, phone: r.phone ?? null, handle: r.handle ?? null },
    }))

    const t = totals || ({} as any)
    return {
      total: num(t.total),
      withMatches: num(t.with_matches),
      noMatches: num(t.no_matches),
      up: num(t.up),
      down: num(t.down),
      rows,
    }
  } catch {
    // Таблицы ещё нет (до миграции) или ошибка — страница покажет «нет данных».
    return null
  }
}
