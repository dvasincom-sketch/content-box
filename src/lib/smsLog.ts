import type { Payload } from 'payload'
import { sqlRows } from '@/lib/sql'

/**
 * Учёт отправленных SMS (sms.ru) для расходной части сводки «Финансы».
 * Пишем факт каждой отправки в таблицу sms_log (миграция
 * 20260913_140000_add_sms_log). Считаем количество и сумму SQL-агрегатом.
 */

/** Стоимость одной SMS у sms.ru, ₽. Можно переопределить env SMS_COST_RUB. */
export const SMS_COST_RUB = Number(process.env.SMS_COST_RUB || 9)

export type SmsKind = 'subscriber_login' | 'studio_login'

/** Для журнала достаточно последних 4 цифр — меньше персональных данных. */
function maskPhone(phone: string): string {
  const d = (phone || '').replace(/\D/g, '')
  if (d.length < 4) return '****'
  return '****' + d.slice(-4)
}

/**
 * Записать факт отправки SMS. НИКОГДА не бросает — сбой журнала не должен
 * ломать вход. cost_rub — снимок цены на момент отправки. Неуспешные отправки
 * тоже логируем (status='failed', cost=0) для диагностики.
 *
 * tenantId=null допустим: вход автора в студию по телефону не привязан к
 * тенанту (авторы глобальны) — такие SMS попадают в «без тенанта».
 */
export async function logSmsSend(
  payload: Payload,
  args: { tenantId: number | string | null; phone: string; kind: SmsKind; ok: boolean },
): Promise<void> {
  try {
    const tenantId =
      args.tenantId != null && Number.isFinite(Number(args.tenantId)) ? Number(args.tenantId) : null
    await sqlRows(
      payload,
      `INSERT INTO sms_log (tenant_id, phone_masked, kind, status, cost_rub)
       VALUES ($1, $2, $3, $4, $5)`,
      [tenantId, maskPhone(args.phone), args.kind, args.ok ? 'sent' : 'failed', args.ok ? SMS_COST_RUB : 0],
    )
  } catch {
    /* журнал не критичен */
  }
}

export interface SmsStats {
  /** Успешно отправлено за всё время. */
  sentTotal: number
  /** Успешно отправлено за последние 30 дней. */
  sent30d: number
  /** Сумма расходов (₽) за всё время по снимкам cost_rub. */
  costTotal: number
  /** Сумма расходов (₽) за последние 30 дней. */
  cost30d: number
}

/**
 * Сводка по SMS для одного тенанта (или по всем — tenantId=null). Только
 * успешные (status='sent') идут в стоимость.
 */
export async function getSmsStats(payload: Payload, tenantId: number | string | null): Promise<SmsStats> {
  const empty: SmsStats = { sentTotal: 0, sent30d: 0, costTotal: 0, cost30d: 0 }
  try {
    const scoped = tenantId != null
    const rows = await sqlRows<{
      sent_total: string
      sent_30d: string
      cost_total: string
      cost_30d: string
    }>(
      payload,
      `SELECT
         COUNT(*) FILTER (WHERE status='sent')::int AS sent_total,
         COUNT(*) FILTER (WHERE status='sent' AND created_at >= now() - interval '30 days')::int AS sent_30d,
         COALESCE(SUM(cost_rub) FILTER (WHERE status='sent'), 0) AS cost_total,
         COALESCE(SUM(cost_rub) FILTER (WHERE status='sent' AND created_at >= now() - interval '30 days'), 0) AS cost_30d
       FROM sms_log
       ${scoped ? 'WHERE tenant_id = $1' : ''}`,
      scoped ? [Number(tenantId)] : [],
    )
    const r = rows[0]
    if (!r) return empty
    return {
      sentTotal: Number(r.sent_total) || 0,
      sent30d: Number(r.sent_30d) || 0,
      costTotal: Math.round(Number(r.cost_total) || 0),
      cost30d: Math.round(Number(r.cost_30d) || 0),
    }
  } catch {
    // Таблицы ещё нет (миграция не применена) / БД недоступна — не роняем UI.
    return empty
  }
}
