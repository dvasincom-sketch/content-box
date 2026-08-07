import type { Payload } from 'payload'
import { logSubscriberActivity } from './logSubscriberActivity'

/** Тип коммерческого события подписки. */
export type SubscriptionAction = 'started' | 'renewed' | 'changed' | 'canceled'

/** id связи независимо от depth (число/строка или populated-объект). */
function relId(v: unknown): number | null {
  if (v == null) return null
  const raw = typeof v === 'object' ? (v as { id?: unknown }).id : v
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

function toTime(v: unknown): number | null {
  if (!v) return null
  const t = new Date(v as string).getTime()
  return Number.isNaN(t) ? null : t
}

/**
 * Запись события подписки в `subscription-events` (overrideAccess — коллекция
 * закрыта на прямой create). Снимок цены/названия тарифа берём из тарифа на
 * момент события. Никогда не бросает — аналитика не должна ломать оплату.
 */
export async function logSubscriptionEvent(
  payload: Payload,
  args: { tenant: unknown; subscriber: unknown; tier: number | null; action: SubscriptionAction },
): Promise<void> {
  const tenant = relId(args.tenant)
  const subscriber = relId(args.subscriber)
  if (!tenant || !subscriber) return

  let tierName: string | null = null
  let priceRub: number | null = null
  if (args.tier) {
    try {
      const t = (await payload.findByID({
        collection: 'subscription-tiers',
        id: args.tier,
        depth: 0,
        overrideAccess: true,
      })) as { name?: string; priceRub?: number } | null
      if (t) {
        tierName = t.name ?? null
        priceRub = typeof t.priceRub === 'number' ? t.priceRub : null
      }
    } catch {
      /* тариф мог быть удалён — пишем событие без снимка */
    }
  }

  try {
    await payload.create({
      collection: 'subscription-events',
      data: { tenant, subscriber, tier: args.tier, tierName, priceRub, action: args.action },
      overrideAccess: true,
    } as any)
  } catch {
    /* игнорируем: аналитика вторична */
  }
}

/**
 * Хук afterChange для Subscribers: сравнивает предыдущее и текущее состояние
 * подписки и пишет событие только при реальном коммерческом переходе:
 *  - не было тарифа → появился         = started
 *  - был тариф → пропал                = canceled
 *  - тариф сменился на другой          = changed
 *  - тот же тариф, дата продлена позже = renewed
 * Прочие изменения подписчика (очки, уровень, вход) событий не создают.
 */
export const subscriptionAfterChange = async ({ doc, previousDoc, req, context, operation }: any): Promise<void> => {
  if (operation !== 'create' && operation !== 'update') return
  // Служебные апдейты (например, отметка входа lastSeenAt) не порождают событий.
  if (context?.skipSubscriptionEvent || req?.context?.skipSubscriptionEvent) return
  const payload = req?.payload
  if (!payload) return

  const prevTier = relId(previousDoc?.activeTier)
  const newTier = relId(doc?.activeTier)
  const prevUntil = toTime(previousDoc?.subscriptionUntil)
  const newUntil = toTime(doc?.subscriptionUntil)

  let action: SubscriptionAction | null = null
  let tier: number | null = newTier

  if (!prevTier && newTier) {
    action = 'started'
  } else if (prevTier && !newTier) {
    action = 'canceled'
    tier = prevTier
  } else if (prevTier && newTier && prevTier !== newTier) {
    action = 'changed'
  } else if (prevTier && newTier && prevTier === newTier) {
    if (newUntil && (!prevUntil || newUntil > prevUntil)) action = 'renewed'
  }

  if (!action) return

  await logSubscriptionEvent(payload, {
    tenant: doc?.tenant,
    subscriber: doc?.id,
    tier,
    action,
  })

  // Журнал действий зрителя (таймлайн в дашборде).
  void logSubscriberActivity(payload, {
    tenant: doc?.tenant,
    subscriber: doc?.id,
    action: action === 'started' ? 'subscribe' : action === 'canceled' ? 'unsubscribe' : 'subscription_change',
    targetType: 'tier',
    targetId: tier,
  })

  // Дублируем оформление/апгрейд платной подписки в общую ленту активности
  // студии (studio-activity) — чтобы «кто оформил платную подписку» было видно
  // владельцу в «Доступе». Actor — подписчик (не users), поэтому имя кладём в title.
  if ((action === 'started' || action === 'changed') && tier) {
    try {
      const tenantId = relId(doc?.tenant)
      if (tenantId) {
        const t = (await payload.findByID({ collection: 'subscription-tiers', id: tier, depth: 0, overrideAccess: true })) as { name?: string } | null
        const subName = doc?.displayName || doc?.email || 'Подписчик'
        const tierName = t?.name || 'подписка'
        await payload.create({
          collection: 'studio-activity',
          data: { tenant: tenantId, action: 'create', entity: 'subscription', title: `${subName} · ${tierName}` },
          overrideAccess: true,
        } as any)
      }
    } catch {
      /* аналитика вторична */
    }
  }
}
