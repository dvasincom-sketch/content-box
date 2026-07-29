import { getPayload } from 'payload'
import config from '@/payload.config'
import { getCurrentSubscriber } from '@/lib/currentSubscriber'
import { tierWeight } from '@/lib/tierWeight'

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

  // Тенант берём из самой публикации — так подписчик обязан принадлежать тому
  // же автору, чей материал открывает. Без этого подписка была кросс-тенантной.
  const tenantId = relId(pub?.tenant)
  if (!tenantId) return { allowed: false, reason: 'need-subscription', requiredTierName }

  const subscriber = await getCurrentSubscriber(tenantId)
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
    tierWeight(payload, minTierId, tenantId),
    tierWeight(payload, activeTierId, tenantId),
  ])

  if (activeWeight == null || minWeight == null) {
    return { allowed: false, reason: 'need-subscription', requiredTierName }
  }
  if (activeWeight >= minWeight) return { allowed: true, subscriber }
  return { allowed: false, reason: 'need-subscription', requiredTierName }
}

/** id связи, независимо от depth. */
function relId(v: unknown): string | null {
  if (v == null) return null
  if (typeof v === 'object') {
    const id = (v as { id?: string | number }).id
    return id == null ? null : String(id)
  }
  return String(v)
}
