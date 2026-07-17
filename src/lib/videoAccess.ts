import { getPayload } from 'payload'
import config from '@/payload.config'
import { getCurrentSubscriber } from '@/lib/currentSubscriber'

/**
 * Проверка доступа подписчика к видео по правилу гейтинга.
 *
 * Видео доступно, если выполняется ХОТЯ БЫ ОДНО:
 *  1) isPreview === true            — бесплатное превью, открыто всем;
 *  2) minTier пусто                 — видео бесплатное для всех;
 *  3) активная подписка достаточного уровня:
 *       - подписчик залогинен и НЕ isBlocked,
 *       - subscriptionUntil в будущем (подписка не истекла),
 *       - weight(activeTier) >= weight(minTier).
 *
 * Подход Б: веса уровней дочитываем из БД по id, не полагаясь на depth от auth().
 *
 * Возвращает:
 *   { allowed: true,  video }                       — доступ есть;
 *   { allowed: false, reason, requiredTierName? }   — доступа нет.
 */

export type VideoAccessResult =
  | { allowed: true; video: any; subscriber: any | null }
  | {
      allowed: false
      reason: 'not-found' | 'need-login' | 'need-subscription' | 'expired' | 'blocked'
      video?: any
      requiredTierName?: string | null
    }

export async function checkVideoAccess(videoIdOrSlug: {
  id?: string | number
  slug?: string
  tenantId?: number | string
}): Promise<VideoAccessResult> {
  const payload = await getPayload({ config: await config })

  // 1) находим видео по id или slug
  let video: any = null
  try {
    if (videoIdOrSlug.id != null) {
      video = await payload.findByID({
        collection: 'videos',
        id: videoIdOrSlug.id,
        depth: 1,
        overrideAccess: true,
      })
    } else if (videoIdOrSlug.slug) {
      const where: any = { slug: { equals: videoIdOrSlug.slug } }
      if (videoIdOrSlug.tenantId != null) where.tenant = { equals: videoIdOrSlug.tenantId }
      const res = await payload.find({
        collection: 'videos',
        where,
        limit: 1,
        depth: 1,
        overrideAccess: true,
      })
      video = res.docs[0] || null
    }
  } catch {
    video = null
  }

  if (!video) return { allowed: false, reason: 'not-found' }

  // 2) бесплатное превью или без minTier — открыто всем
  const minTier = video.minTier
  const minTierId = minTier ? (typeof minTier === 'object' ? minTier.id : minTier) : null
  if (video.isPreview || !minTierId) {
    const subscriber = await getCurrentSubscriber()
    return { allowed: true, video, subscriber }
  }

  // 3) нужна подписка — проверяем подписчика
  const subscriber = await getCurrentSubscriber()
  const requiredTierName =
    minTier && typeof minTier === 'object' ? minTier.name || minTier.slug : null

  if (!subscriber) {
    return { allowed: false, reason: 'need-login', video, requiredTierName }
  }
  if (subscriber.isBlocked) {
    return { allowed: false, reason: 'blocked', video, requiredTierName }
  }

  // подписка не истекла
  const until = subscriber.subscriptionUntil ? new Date(subscriber.subscriptionUntil) : null
  if (!until || until.getTime() <= Date.now()) {
    return { allowed: false, reason: 'expired', video, requiredTierName }
  }

  // активный уровень подписчика
  const activeTier = subscriber.activeTier
  const activeTierId = activeTier ? (typeof activeTier === 'object' ? activeTier.id : activeTier) : null
  if (!activeTierId) {
    return { allowed: false, reason: 'need-subscription', video, requiredTierName }
  }

  // Подход Б: дочитываем веса обоих уровней из БД
  const [minWeight, activeWeight] = await Promise.all([
    tierWeight(payload, minTierId),
    tierWeight(payload, activeTierId),
  ])

  if (activeWeight == null || minWeight == null) {
    return { allowed: false, reason: 'need-subscription', video, requiredTierName }
  }

  if (activeWeight >= minWeight) {
    return { allowed: true, video, subscriber }
  }

  return { allowed: false, reason: 'need-subscription', video, requiredTierName }
}

/** Вес уровня по id (или null, если не найден). */
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
