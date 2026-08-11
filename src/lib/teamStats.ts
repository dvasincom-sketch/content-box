import type { Payload } from 'payload'

/**
 * Аналитика по команде студии (контрибьюторы/участники тенанта) для раздела
 * «Аналитика → Команда». Источник — журнал `studio_activity` (вход + создание/
 * правка/удаление контента) и список участников из `users`.
 *
 *  - Время на сайте — оценка по журналу: внутри дня берём разрывы между
 *    соседними событиями участника, каждый ограничиваем 30 мин (LLM-стиль
 *    «активной сессии»). Одиночные события дают ~0 мин, но день считается
 *    активным. Это оценка, а не точный трекинг.
 *  - Публикации/материалы — события action='create' (entity='publication' и
 *    все сущности). Правки — action='update'.
 *  - Ср. время на публикацию = активное время / число созданных публикаций.
 *
 * Ошибки БД (нет таблицы до миграции и т.п.) не роняют страницу — вернём null.
 */

export interface TeamMemberStat {
  userId: number
  name: string
  email: string
  role: string
  disabled: boolean
  activeDays: number
  activeMinutes: number
  pubs: number
  materials: number
  edits: number
  avgPerPubMin: number | null
  lastActive: string | null
  daily: { day: string; minutes: number }[]
}

export interface TeamStats {
  periodDays: number
  members: TeamMemberStat[]
}

type PoolLike = { query: (t: string, p: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }> }
const num = (v: unknown): number => Number(v) || 0
const ROLE_LABEL: Record<string, string> = {
  editor: 'Владелец', admin: 'Администратор', contributor: 'Участник', viewer: 'Наблюдатель',
}

export async function getTeamStats(payload: Payload, tenantId: number | string, days = 30): Promise<TeamStats | null> {
  const pool = (payload.db as unknown as { pool?: PoolLike }).pool
  if (!pool || typeof pool.query !== 'function') return null
  const period = [7, 30, 90].includes(days) ? days : 30
  const since = new Date(Date.now() - period * 86400000).toISOString()

  try {
    // A. Активное время по участнику и дню (разрывы между событиями, cap 30 мин).
    const dailySql = `
      WITH ev AS (
        SELECT user_id,
               (created_at AT TIME ZONE 'Europe/Moscow')::date AS day,
               created_at,
               created_at - LAG(created_at) OVER (
                 PARTITION BY user_id, (created_at AT TIME ZONE 'Europe/Moscow')::date
                 ORDER BY created_at
               ) AS gap
        FROM studio_activity
        WHERE tenant_id = $1 AND created_at >= $2 AND user_id IS NOT NULL
      )
      SELECT user_id,
             to_char(day, 'YYYY-MM-DD') AS day,
             COALESCE(SUM(LEAST(EXTRACT(EPOCH FROM gap), 1800)) FILTER (WHERE gap IS NOT NULL), 0) AS active_sec,
             COUNT(*) AS events
      FROM ev
      GROUP BY user_id, day
      ORDER BY day`
    // B. Продуктивность по участнику.
    const prodSql = `
      SELECT user_id,
             COUNT(*) FILTER (WHERE action = 'create' AND entity = 'publication') AS pubs,
             COUNT(*) FILTER (WHERE action = 'create') AS materials,
             COUNT(*) FILTER (WHERE action = 'update') AS edits,
             MAX(created_at) AS last_active
      FROM studio_activity
      WHERE tenant_id = $1 AND created_at >= $2 AND user_id IS NOT NULL
      GROUP BY user_id`
    // C. Участники тенанта (без суперадминов).
    const usersSql = `
      SELECT id, COALESCE(name, '') AS name, COALESCE(email, '') AS email,
             COALESCE(tenant_role, '') AS role, COALESCE(disabled, false) AS disabled
      FROM users
      WHERE tenant_id = $1 AND (platform_role IS NULL OR platform_role <> 'superadmin')
      ORDER BY tenant_role, name`

    const [dailyR, prodR, usersR] = await Promise.all([
      pool.query(dailySql, [tenantId, since]),
      pool.query(prodSql, [tenantId, since]),
      pool.query(usersSql, [tenantId]),
    ])

    const dailyByUser = new Map<number, { day: string; minutes: number }[]>()
    const totalsByUser = new Map<number, { sec: number; days: number }>()
    for (const r of dailyR.rows) {
      const uid = num(r.user_id)
      const minutes = Math.round(num(r.active_sec) / 60)
      const arr = dailyByUser.get(uid) || []
      arr.push({ day: String(r.day), minutes })
      dailyByUser.set(uid, arr)
      const t = totalsByUser.get(uid) || { sec: 0, days: 0 }
      t.sec += num(r.active_sec)
      t.days += 1
      totalsByUser.set(uid, t)
    }

    const prodByUser = new Map<number, { pubs: number; materials: number; edits: number; last: string | null }>()
    for (const r of prodR.rows) {
      prodByUser.set(num(r.user_id), {
        pubs: num(r.pubs), materials: num(r.materials), edits: num(r.edits),
        last: r.last_active ? new Date(r.last_active as string).toISOString() : null,
      })
    }

    const members: TeamMemberStat[] = (usersR.rows || []).map((u) => {
      const uid = num(u.id)
      const totals = totalsByUser.get(uid) || { sec: 0, days: 0 }
      const prod = prodByUser.get(uid) || { pubs: 0, materials: 0, edits: 0, last: null }
      const activeMinutes = Math.round(totals.sec / 60)
      return {
        userId: uid,
        name: String(u.name || '') || String(u.email || '').split('@')[0] || `Участник ${uid}`,
        email: String(u.email || ''),
        role: ROLE_LABEL[String(u.role || '')] || String(u.role || '—'),
        disabled: Boolean(u.disabled),
        activeDays: totals.days,
        activeMinutes,
        pubs: prod.pubs,
        materials: prod.materials,
        edits: prod.edits,
        avgPerPubMin: prod.pubs > 0 ? Math.round(activeMinutes / prod.pubs) : null,
        lastActive: prod.last,
        daily: dailyByUser.get(uid) || [],
      }
    })

    // Активные — вперёд (по числу материалов, затем по времени).
    members.sort((a, b) => b.materials - a.materials || b.activeMinutes - a.activeMinutes)
    return { periodDays: period, members }
  } catch {
    return null
  }
}
