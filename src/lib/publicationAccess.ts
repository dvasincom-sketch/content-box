import { getPayload } from 'payload'
import config from '@/payload.config'
import { getCurrentSubscriber } from '@/lib/currentSubscriber'

/**
 * Проверка доступа подписчика к ПУБЛИКАЦИИ по её minTier.
 * Та же модель весов, что у видео.
 *
 * Доступ есть, если:
 *  - minTier пусто (публикация бесплатная), ИЛИ
 *  - активная подписка достаточного уровня (не blocked, не истекла,
 *    weight(activeTier) >= weight(minTier)).
 *
 * Веса дочитываем из БД по id (Подход Б), не полагаясь на depth от auth().
 */

export type PubAccess =
  | { allowed: true; subscriber: any | null }
  | {
      allowed: false
      reason: 'need-login' | 'need-subscription' | 'expired' | 'blocked'
      requiredTierName: string | null
    }

export async function checkPublicationAccess(pub: any): Promise<PubAccess> {
  const minTier = pub?.minTier
  const minTierId = minTier ? (typeof minTier === 'object' ? minTier.id : minTier) : null

  // бесплатная публикация — открыта всем
  if (!minTierId) return { allowed: true, subscriber: null }

  const requiredTierName =
    minTier && typeof minTier === 'object' ? minTier.name || minTier.slug : null

  const subscriber = await getCurrentSubscriber()
  if (!subscriber) return { allowed: false, reason: 'need-login', requiredTierName }
  if (subscriber.isBlocked) return { allowed: false, reason: 'blocked', requiredTierName }

  const until = subscriber.subscriptionUntil ? new Date(subscriber.subscriptionUntil) : null
  if (!until || until.getTime() <= Date.now()) {
    return { allowed: false, reason: 'expired', requiredTierName }
  }

  const activeTier = subscriber.activeTier
  const activeTierId = activeTier ? (typeof activeTier === 'object' ? activeTier.id : activeTier) : null
  if (!activeTierId) return { allowed: false, reason: 'need-subscription', requiredTierName }

  const payload = await getPayload({ config: await config })
  const [minWeight, activeWeight] = await Promise.all([
    tierWeight(payload, minTierId),
    tierWeight(payload, activeTierId),
  ])

  if (activeWeight == null || minWeight == null) {
    return { allowed: false, reason: 'need-subscription', requiredTierName }
  }
  if (activeWeight >= minWeight) return { allowed: true, subscriber }
  return { allowed: false, reason: 'need-subscription', requiredTierName }
}

async function tierWeight(payload: any, tierId: string | number): Promise<number | null> {
  try {
    const t = await payload.findByID({
      collection: 'subscription-tiers',
      id: tierId,
      depth: 0,
      overrideAccess: true,
    })
    return typeof t?.weight === 'number' ? t.weight : null
  } catch {
    return null
  }
}
