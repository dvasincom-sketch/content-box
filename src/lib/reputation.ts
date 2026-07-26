import type { Payload } from 'payload'

/**
 * Движок репутации (Фаза 2 «Сообщество»). Все настройки — здесь, легко тюнить.
 *
 * Две вещи:
 *  1) Конфиг: веса очков, множитель платного бонуса, уровни (пороги + имена).
 *  2) awardActivity/reverseActivity — идемпотентное начисление/откат очков с
 *     кэшированием points/level на подписчике. Источник истины — коллекция
 *     `activity-events` (по одному событию на объект: type+refType+refId).
 *
 * Начисляем ТОЛЬКО за одобренные (published) комментарии и ПОЛУЧЕННЫЕ реакции —
 * это устойчиво к накрутке. Платным — ускоренная прокачка (реш.7). Всё best-effort:
 * ошибки очков не ломают основную операцию.
 */

export type ActivityType = 'comment' | 'reaction_received'

/** Базовые очки за действие (до множителя платного бонуса). */
export const POINT_WEIGHTS: Record<ActivityType, number> = {
  comment: 5,
  reaction_received: 2,
}

/** Ускоренная прокачка для платных подписчиков. */
export const PAID_MULTIPLIER = 1.5

/** Уровни по возрастанию: порог накопленных очков + имя. */
export const LEVELS: { min: number; name: string }[] = [
  { min: 0, name: 'Новичок' },
  { min: 10, name: 'Читатель' },
  { min: 50, name: 'Активный' },
  { min: 150, name: 'Знаток' },
  { min: 400, name: 'Ветеран' },
  { min: 1000, name: 'Легенда' },
]

export function levelIndexForPoints(points: number): number {
  let idx = 0
  for (let i = 0; i < LEVELS.length; i++) if (points >= LEVELS[i].min) idx = i
  return idx
}
export function levelName(idx: number | null | undefined): string {
  const i = Math.max(0, Math.min(Math.floor(idx || 0), LEVELS.length - 1))
  return LEVELS[i].name
}
/** Следующий уровень (для прогресса) или null, если максимум. */
export function nextLevel(points: number): { min: number; name: string } | null {
  for (const l of LEVELS) if (points < l.min) return l
  return null
}

const SLUG = 'activity-events'

function relID(v: any): number | null {
  if (v == null) return null
  const raw = typeof v === 'object' ? v.id : v
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

async function setPoints(payload: Payload, subscriberId: number, newPoints: number): Promise<void> {
  const pts = Math.max(0, Math.round(newPoints))
  await payload.update({
    collection: 'subscribers',
    id: subscriberId,
    data: { points: pts, level: levelIndexForPoints(pts) } as any,
    overrideAccess: true,
  })
}

/** Начислить очки получателю. Идемпотентно по (subscriber,type,refType,refId). */
export async function awardActivity(
  payload: Payload,
  args: { subscriberId: number | string | null; type: ActivityType; refType: string; refId: string | number },
): Promise<void> {
  const subscriberId = relID(args.subscriberId)
  if (subscriberId == null) return
  const refId = String(args.refId)
  try {
    const sub = (await payload
      .findByID({ collection: 'subscribers', id: subscriberId, depth: 0, overrideAccess: true })
      .catch(() => null)) as any
    if (!sub || sub.isBlocked) return

    const existing = await payload.find({
      collection: SLUG as any,
      where: {
        and: [
          { subscriber: { equals: subscriberId } },
          { type: { equals: args.type } },
          { refType: { equals: args.refType } },
          { refId: { equals: refId } },
        ],
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (existing.docs.length > 0) return

    const base = POINT_WEIGHTS[args.type] ?? 0
    const pts = Math.round(base * (sub.activeTier ? PAID_MULTIPLIER : 1))
    const tenantId = relID(sub.tenant)

    await payload.create({
      collection: SLUG as any,
      data: {
        tenant: tenantId,
        subscriber: subscriberId,
        type: args.type,
        points: pts,
        refType: args.refType,
        refId,
      } as any,
      overrideAccess: true,
    })
    await setPoints(payload, subscriberId, (Number(sub.points) || 0) + pts)
  } catch {
    /* очки best-effort */
  }
}

/** Откатить начисление по (type,refType,refId). Получателя берём из события. */
export async function reverseActivity(
  payload: Payload,
  args: { type: ActivityType; refType: string; refId: string | number },
): Promise<void> {
  const refId = String(args.refId)
  try {
    const found = await payload.find({
      collection: SLUG as any,
      where: {
        and: [
          { type: { equals: args.type } },
          { refType: { equals: args.refType } },
          { refId: { equals: refId } },
        ],
      },
      limit: 10,
      depth: 0,
      overrideAccess: true,
    })
    for (const ev of found.docs as any[]) {
      const subId = relID(ev.subscriber)
      const pts = Number(ev.points) || 0
      await payload.delete({ collection: SLUG as any, id: ev.id, overrideAccess: true })
      if (subId != null) {
        const sub = (await payload
          .findByID({ collection: 'subscribers', id: subId, depth: 0, overrideAccess: true })
          .catch(() => null)) as any
        if (sub) await setPoints(payload, subId, (Number(sub.points) || 0) - pts)
      }
    }
  } catch {
    /* best-effort */
  }
}
