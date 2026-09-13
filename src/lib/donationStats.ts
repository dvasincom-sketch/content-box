import type { Payload } from 'payload'
import { sqlRows } from '@/lib/sql'

/**
 * Статистика донатов (support_payments) тенанта для дашборда и страницы
 * «Донаты». В стоимость идут только успешные (status='succeeded').
 */
export interface DonationStats {
  total: number // сумма succeeded за всё время, ₽
  count: number // число succeeded за всё время
  sum30d: number // сумма succeeded за 30 дней
  count30d: number // число succeeded за 30 дней
}

export async function getDonationStats(payload: Payload, tenantId: number | string): Promise<DonationStats> {
  const empty: DonationStats = { total: 0, count: 0, sum30d: 0, count30d: 0 }
  try {
    const rows = await sqlRows<{ total: string; cnt: string; sum30: string; cnt30: string }>(
      payload,
      `SELECT
         COALESCE(SUM(amount_rub) FILTER (WHERE status='succeeded'), 0) AS total,
         COUNT(*) FILTER (WHERE status='succeeded')::int AS cnt,
         COALESCE(SUM(amount_rub) FILTER (WHERE status='succeeded' AND created_at >= now() - interval '30 days'), 0) AS sum30,
         COUNT(*) FILTER (WHERE status='succeeded' AND created_at >= now() - interval '30 days')::int AS cnt30
       FROM support_payments
       WHERE tenant_id = $1`,
      [Number(tenantId)],
    )
    const r = rows[0]
    if (!r) return empty
    return {
      total: Math.round(Number(r.total) || 0),
      count: Number(r.cnt) || 0,
      sum30d: Math.round(Number(r.sum30) || 0),
      count30d: Number(r.cnt30) || 0,
    }
  } catch {
    return empty
  }
}
