import type { Payload } from 'payload'

/**
 * Коммерческая статистика тенанта для дашборда: зарегистрированные и платные
 * пользователи, конверсия, выручка в месяц (MRR), плюс дневной ряд за 90 дней
 * (регистрации + новые платные) для графика с переключателем 7/30/90.
 *
 *  - registered   — всего подписчиков;
 *  - registered7d — новых за 7 дней (дельта под KPI);
 *  - paid         — активные платные (есть тариф и подписка не истекла);
 *  - conversion   — paid / registered, %;
 *  - mrr          — сумма priceRub активных платных, ₽/мес;
 *  - series[90]   — по дню: regs (регистрации), paid (события 'started').
 *
 * Платные «в динамике» считаем из subscription_events (лог начал вестись с
 * внедрения) — исторические данные до этого по платным недоступны, линия до
 * первого события будет нулевой; регистрации строятся по subscribers.created_at
 * и доступны за всю историю.
 *
 * Всё одним-двумя SQL-агрегатами через пул БД. Ошибки не роняют дашборд.
 */

export interface CommerceDay {
  day: string // YYYY-MM-DD
  regs: number
  paid: number
}

export interface CommerceStats {
  registered: number
  registered7d: number
  paid: number
  conversion: number // проценты, 0..100
  mrr: number // ₽/мес
  series: CommerceDay[]
}

type PoolLike = { query: (text: string, params: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }> }

export async function getCommerceStats(payload: Payload, tenantId: number | string): Promise<CommerceStats | null> {
  const pool = (payload.db as unknown as { pool?: PoolLike }).pool
  if (!pool || typeof pool.query !== 'function') return null

  const kpiSql = `
    SELECT
      (SELECT COUNT(*)::int FROM subscribers WHERE tenant_id = $1) AS registered,
      (SELECT COUNT(*)::int FROM subscribers WHERE tenant_id = $1 AND created_at >= now() - interval '7 days') AS registered7d,
      (SELECT COUNT(*)::int FROM subscribers
         WHERE tenant_id = $1 AND active_tier_id IS NOT NULL
           AND (subscription_until IS NULL OR subscription_until > now())) AS paid,
      COALESCE((SELECT SUM(t.price_rub) FROM subscribers s
         JOIN subscription_tiers t ON t.id = s.active_tier_id
         WHERE s.tenant_id = $1 AND s.active_tier_id IS NOT NULL
           AND (s.subscription_until IS NULL OR s.subscription_until > now())), 0) AS mrr
  `

  const seriesSql = `
    SELECT to_char(d, 'YYYY-MM-DD') AS day,
      (SELECT COUNT(*)::int FROM subscribers s
         WHERE s.tenant_id = $1 AND s.created_at::date = d::date) AS regs,
      (SELECT COUNT(*)::int FROM subscription_events e
         WHERE e.tenant_id = $1 AND e.action = 'started' AND e.created_at::date = d::date) AS paid
    FROM generate_series((now()::date - interval '89 days'), now()::date, interval '1 day') d
    ORDER BY d
  `

  try {
    const [kpiRes, seriesRes] = await Promise.all([
      pool.query(kpiSql, [tenantId]),
      pool.query(seriesSql, [tenantId]),
    ])
    const k = kpiRes.rows[0] || {}
    const registered = Number(k.registered) || 0
    const paid = Number(k.paid) || 0
    const series: CommerceDay[] = seriesRes.rows.map((r) => ({
      day: String(r.day),
      regs: Number(r.regs) || 0,
      paid: Number(r.paid) || 0,
    }))
    return {
      registered,
      registered7d: Number(k.registered7d) || 0,
      paid,
      conversion: registered > 0 ? Math.round((paid / registered) * 1000) / 10 : 0,
      mrr: Math.round(Number(k.mrr) || 0),
      series,
    }
  } catch {
    return null
  }
}

/**
 * Выручка (MRR) ретроспективно по месяцам — срез активных платных подписок на
 * КОНЕЦ каждого месяца (для текущего месяца — на «сейчас»). Нужна для честной
 * помесячной комиссии в биллинге: раньше подписчиков было меньше → и комиссия
 * за прошлые месяцы ниже.
 *
 * «Активна в срезе D» = есть платный тариф, подписка началась не позже D
 * (`subscription_since`, иначе дата регистрации) и ещё не истекла на D
 * (`subscription_until` NULL или > D). Цена берётся по текущему тарифу подписчика
 * (историю смены тарифов не реконструируем — это оценка, как и весь биллинг).
 *
 * @param months список 'YYYY-MM'
 * @returns карта { 'YYYY-MM': mrr_руб }
 */
export async function getMonthlyMrr(
  payload: Payload,
  tenantId: number | string,
  months: string[],
): Promise<Record<string, number>> {
  const out: Record<string, number> = {}
  const list = (months || []).filter((m) => /^\d{4}-\d{2}$/.test(m))
  if (list.length === 0) return out
  const pool = (payload.db as unknown as { pool?: PoolLike }).pool
  if (!pool || typeof pool.query !== 'function') return out

  const sql = `
    WITH ref AS (
      SELECT ym,
             LEAST(date_trunc('month', to_date(ym, 'YYYY-MM')) + interval '1 month' - interval '1 second', now()) AS d
      FROM unnest($2::text[]) AS ym
    )
    SELECT r.ym AS ym,
           COALESCE(SUM(t.price_rub), 0)::int AS mrr
    FROM ref r
    LEFT JOIN subscribers s
      ON s.tenant_id = $1
     AND s.active_tier_id IS NOT NULL
     AND COALESCE(s.subscription_since, s.created_at) <= r.d
     AND (s.subscription_until IS NULL OR s.subscription_until > r.d)
    LEFT JOIN subscription_tiers t ON t.id = s.active_tier_id
    GROUP BY r.ym`
  try {
    const res = await pool.query(sql, [tenantId, list])
    for (const row of res.rows) out[String(row.ym)] = Number(row.mrr) || 0
  } catch {
    /* нет таблиц/ошибка — вернём пустую карту, панель откатится на текущую оценку */
  }
  return out
}

/**
 * Формат выручки для узкой KPI-карточки: до 100 тыс. — точно с разделителями,
 * дальше сокращаем (999 999 ₽ влезает; миллионы — «1,2 млн ₽»), чтобы значение
 * не переносилось и не обрезалось в четверти ширины.
 */
export function formatRub(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '0 ₽'
  const v = Math.round(n)
  if (v >= 1_000_000) {
    const m = Math.round(v / 100_000) / 10
    return `${m.toLocaleString('ru-RU')} млн ₽`
  }
  return `${v.toLocaleString('ru-RU')} ₽`
}
