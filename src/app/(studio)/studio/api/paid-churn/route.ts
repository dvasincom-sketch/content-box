import { withAuthor, apiError, apiOk, isContributor } from '@/app/(studio)/studio/api/_lib'

/**
 * Движение платных подписчиков за период — для плашки «Платных» на дашборде.
 * GET ?days=7|30|90 (по умолчанию 30). Только владелец студии.
 *
 * Ответ: { days, lost: Row[], started: Row[], expiring: Row[] }
 *  - lost     — перестали быть платными за период. Две причины:
 *      · 'expired'  — истёк subscription_until (в журнал событий НЕ пишется:
 *                     документ не меняется, просто наступает дата);
 *      · 'canceled' — тариф сняли (событие canceled в subscription_events).
 *    Кто уже снова платный (продлил/оформил заново) — из «ушедших» исключается.
 *  - started  — оформили платную подписку за период (события started).
 *  - expiring — активные платные, у которых подписка истекает в ближайшие 14 дней.
 *
 * Идентификаторы — SQL-агрегатами через пул, данные людей — через payload.find
 * (не завязываемся на имена колонок профиля в сыром SQL).
 */

export const runtime = 'nodejs'

type PoolLike = { query: (text: string, params: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }> }

type Row = {
  subscriberId: number | null
  name: string
  email: string
  tierName: string | null
  at: string // когда произошло (для expiring — дата окончания)
  reason?: 'expired' | 'canceled'
  paidNow: boolean
  subscriptionUntil: string | null
}

const ALLOWED_DAYS = [7, 30, 90]
const EXPIRING_DAYS = 14

export const GET = withAuthor(async ({ req, payload, tenantId, author }) => {
  if (isContributor(author)) return apiError('Доступно только владельцу студии', 403)
  const daysRaw = Number(req.nextUrl.searchParams.get('days'))
  const days = ALLOWED_DAYS.includes(daysRaw) ? daysRaw : 30

  const pool = (payload.db as unknown as { pool?: PoolLike }).pool
  if (!pool || typeof pool.query !== 'function') return apiError('База недоступна', 500)

  try {
    const [expiredRes, canceledRes, startedRes, expiringRes] = await Promise.all([
      pool.query(
        `SELECT id AS sid, subscription_until AS at FROM subscribers
          WHERE tenant_id = $1 AND active_tier_id IS NOT NULL
            AND subscription_until <= now()
            AND subscription_until > now() - make_interval(days => $2::int)`,
        [tenantId, days],
      ),
      pool.query(
        `SELECT subscriber_id AS sid, tier_name, created_at AS at FROM subscription_events
          WHERE tenant_id = $1 AND action = 'canceled'
            AND created_at > now() - make_interval(days => $2::int)
          ORDER BY created_at DESC`,
        [tenantId, days],
      ),
      pool.query(
        `SELECT subscriber_id AS sid, tier_name, created_at AS at FROM subscription_events
          WHERE tenant_id = $1 AND action = 'started'
            AND created_at > now() - make_interval(days => $2::int)
          ORDER BY created_at DESC`,
        [tenantId, days],
      ),
      pool.query(
        `SELECT id AS sid, subscription_until AS at FROM subscribers
          WHERE tenant_id = $1 AND active_tier_id IS NOT NULL
            AND subscription_until > now()
            AND subscription_until <= now() + make_interval(days => $2::int)
          ORDER BY subscription_until ASC`,
        [tenantId, EXPIRING_DAYS],
      ),
    ])

    // Профили всех упомянутых подписчиков одним запросом.
    const ids = new Set<number>()
    for (const r of [...expiredRes.rows, ...canceledRes.rows, ...startedRes.rows, ...expiringRes.rows]) {
      const n = Number(r.sid)
      if (Number.isFinite(n) && n > 0) ids.add(n)
    }
    const subs = ids.size
      ? ((
          await payload.find({
            collection: 'subscribers',
            where: { and: [{ tenant: { equals: tenantId } }, { id: { in: [...ids] } }] },
            limit: ids.size,
            depth: 1,
            overrideAccess: true,
          })
        ).docs as any[])
      : []
    const byId = new Map<number, any>(subs.map((s) => [Number(s.id), s]))

    const now = Date.now()
    const isPaidNow = (s: any) => {
      if (!s?.activeTier) return false
      if (!s.subscriptionUntil) return true
      return new Date(s.subscriptionUntil).getTime() > now
    }
    const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : '')
    const toRow = (sid: unknown, at: unknown, tierSnapshot?: unknown): Row => {
      const n = Number(sid)
      const s = sid != null && Number.isFinite(n) ? byId.get(n) : undefined
      const tier = s?.activeTier && typeof s.activeTier === 'object' ? s.activeTier : null
      return {
        subscriberId: s ? n : null,
        name: s ? String(s.displayName || s.email || 'Подписчик') : 'Удалённый пользователь',
        email: s ? String(s.email || '') : '',
        tierName: (typeof tierSnapshot === 'string' && tierSnapshot) || (tier ? tier.name || tier.slug || null : null),
        at: iso(at),
        paidNow: s ? isPaidNow(s) : false,
        subscriptionUntil: s?.subscriptionUntil ? iso(s.subscriptionUntil) : null,
      }
    }

    // Ушедшие: истёкшие + снятые, по одному на человека (последнее событие),
    // исключая тех, кто сейчас снова платный.
    const lostMap = new Map<string, Row>()
    const pushLost = (row: Row, reason: 'expired' | 'canceled', key: string) => {
      if (row.paidNow) return
      const prev = lostMap.get(key)
      if (!prev || prev.at < row.at) lostMap.set(key, { ...row, reason })
    }
    expiredRes.rows.forEach((r) => pushLost(toRow(r.sid, r.at), 'expired', `s${r.sid}`))
    canceledRes.rows.forEach((r, i) =>
      pushLost(toRow(r.sid, r.at, r.tier_name), 'canceled', r.sid != null ? `s${r.sid}` : `x${i}`),
    )
    const lost = [...lostMap.values()].sort((a, b) => (a.at < b.at ? 1 : -1))

    // Новые: по одному на человека (последнее оформление в периоде).
    const startedMap = new Map<string, Row>()
    startedRes.rows.forEach((r, i) => {
      const key = r.sid != null ? `s${r.sid}` : `x${i}`
      if (!startedMap.has(key)) startedMap.set(key, toRow(r.sid, r.at, r.tier_name))
    })
    const started = [...startedMap.values()]

    const expiring = expiringRes.rows.map((r) => toRow(r.sid, r.at))

    return apiOk({ days, expiringDays: EXPIRING_DAYS, lost, started, expiring })
  } catch {
    return apiError('Не удалось посчитать движение подписок', 500)
  }
})
