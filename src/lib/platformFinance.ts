import type { Payload } from 'payload'
import { sqlRows } from '@/lib/sql'

/**
 * Владельческая сводка «Финансы» по ВСЕМ авторам (тенантам): доходы (подписки +
 * донаты, только succeeded) минус расходы (SMS по журналу sms_log + почтовый
 * сервер фиксированной суммой). Считаем несколькими GROUP BY-агрегатами и
 * сводим в JS по tenant_id. Только для superadmin.
 *
 * Почта — общий фиксированный расход платформы (RuSender), не привязан к
 * тенанту: показываем отдельной строкой, между авторами НЕ делим.
 */

/** Абонплата за почтовый сервер, ₽/мес. Переопределяется env EMAIL_MONTHLY_RUB. */
export const EMAIL_MONTHLY_RUB = Number(process.env.EMAIL_MONTHLY_RUB || 1000)

export interface TenantFinanceRow {
  tenantId: number | null
  name: string
  subsTotal: number
  subs30d: number
  donationsTotal: number
  donations30d: number
  smsSentTotal: number
  smsSent30d: number
  smsCostTotal: number
  smsCost30d: number
}

export interface PlatformFinance {
  rows: TenantFinanceRow[]
  emailMonthly: number
  totals: {
    subsTotal: number
    subs30d: number
    donationsTotal: number
    donations30d: number
    smsSentTotal: number
    smsSent30d: number
    smsCostTotal: number
    smsCost30d: number
    /** Доход за 30 дней (подписки + донаты). */
    income30d: number
    /** Расход за 30 дней (SMS + почта). */
    expense30d: number
    /** Чистыми за 30 дней. */
    net30d: number
  }
}

type Row = Record<string, unknown>
const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0)

/** Безопасный агрегат: при отсутствии таблицы/ошибке возвращаем []. */
async function safeRows(payload: Payload, text: string): Promise<Row[]> {
  try {
    return await sqlRows<Row>(payload, text)
  } catch {
    return []
  }
}

export async function getPlatformFinance(payload: Payload): Promise<PlatformFinance> {
  const [tenants, subs, dons, sms] = await Promise.all([
    safeRows(payload, `SELECT id, name FROM tenants ORDER BY name`),
    safeRows(
      payload,
      `SELECT tenant_id,
         COALESCE(SUM(amount_rub) FILTER (WHERE status='succeeded'),0) AS total,
         COALESCE(SUM(amount_rub) FILTER (WHERE status='succeeded' AND created_at >= now()-interval '30 days'),0) AS d30
       FROM subscription_payments GROUP BY tenant_id`,
    ),
    safeRows(
      payload,
      `SELECT tenant_id,
         COALESCE(SUM(amount_rub) FILTER (WHERE status='succeeded'),0) AS total,
         COALESCE(SUM(amount_rub) FILTER (WHERE status='succeeded' AND created_at >= now()-interval '30 days'),0) AS d30
       FROM support_payments GROUP BY tenant_id`,
    ),
    safeRows(
      payload,
      `SELECT tenant_id,
         COUNT(*) FILTER (WHERE status='sent')::int AS cnt,
         COUNT(*) FILTER (WHERE status='sent' AND created_at >= now()-interval '30 days')::int AS cnt30,
         COALESCE(SUM(cost_rub) FILTER (WHERE status='sent'),0) AS cost,
         COALESCE(SUM(cost_rub) FILTER (WHERE status='sent' AND created_at >= now()-interval '30 days'),0) AS cost30
       FROM sms_log GROUP BY tenant_id`,
    ),
  ])

  // Заготовка строк по всем тенантам (даже с нулями) + «Без тенанта» для
  // SMS-логов с tenant_id=null (вход авторов в студию).
  const map = new Map<string, TenantFinanceRow>()
  const keyOf = (id: unknown) => (id == null ? 'null' : String(id))
  const ensure = (id: number | null, name: string): TenantFinanceRow => {
    const k = keyOf(id)
    let r = map.get(k)
    if (!r) {
      r = {
        tenantId: id,
        name,
        subsTotal: 0,
        subs30d: 0,
        donationsTotal: 0,
        donations30d: 0,
        smsSentTotal: 0,
        smsSent30d: 0,
        smsCostTotal: 0,
        smsCost30d: 0,
      }
      map.set(k, r)
    }
    return r
  }

  for (const t of tenants) ensure(num(t.id), String(t.name || `Тенант #${t.id}`))

  for (const s of subs) {
    const r = ensure(s.tenant_id == null ? null : num(s.tenant_id), s.tenant_id == null ? 'Без тенанта' : `Тенант #${s.tenant_id}`)
    r.subsTotal += Math.round(num(s.total))
    r.subs30d += Math.round(num(s.d30))
  }
  for (const d of dons) {
    const r = ensure(d.tenant_id == null ? null : num(d.tenant_id), d.tenant_id == null ? 'Без тенанта' : `Тенант #${d.tenant_id}`)
    r.donationsTotal += Math.round(num(d.total))
    r.donations30d += Math.round(num(d.d30))
  }
  for (const m of sms) {
    const r = ensure(m.tenant_id == null ? null : num(m.tenant_id), m.tenant_id == null ? 'Без тенанта (вход авторов)' : `Тенант #${m.tenant_id}`)
    r.smsSentTotal += num(m.cnt)
    r.smsSent30d += num(m.cnt30)
    r.smsCostTotal += Math.round(num(m.cost))
    r.smsCost30d += Math.round(num(m.cost30))
  }

  // Убираем пустые строки (тенант без единого движения), кроме «Без тенанта»
  // с реальными SMS. Сортируем по доходу за 30 дней.
  const rows = [...map.values()]
    .filter(
      (r) =>
        r.subsTotal || r.donationsTotal || r.smsSentTotal || r.tenantId != null, // именованные тенанты оставляем всегда
    )
    .sort((a, b) => b.subs30d + b.donations30d - (a.subs30d + a.donations30d))

  const totals = rows.reduce(
    (acc, r) => {
      acc.subsTotal += r.subsTotal
      acc.subs30d += r.subs30d
      acc.donationsTotal += r.donationsTotal
      acc.donations30d += r.donations30d
      acc.smsSentTotal += r.smsSentTotal
      acc.smsSent30d += r.smsSent30d
      acc.smsCostTotal += r.smsCostTotal
      acc.smsCost30d += r.smsCost30d
      return acc
    },
    {
      subsTotal: 0,
      subs30d: 0,
      donationsTotal: 0,
      donations30d: 0,
      smsSentTotal: 0,
      smsSent30d: 0,
      smsCostTotal: 0,
      smsCost30d: 0,
      income30d: 0,
      expense30d: 0,
      net30d: 0,
    },
  )
  totals.income30d = totals.subs30d + totals.donations30d
  totals.expense30d = totals.smsCost30d + EMAIL_MONTHLY_RUB
  totals.net30d = totals.income30d - totals.expense30d

  return { rows, emailMonthly: EMAIL_MONTHLY_RUB, totals }
}
