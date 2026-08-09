import { getPayload } from 'payload'
import config from '@/payload.config'
import { getCurrentSubscriber } from '@/lib/currentSubscriber'
import { tierWeight } from '@/lib/tierWeight'

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
  /**
   * Тенант ОБЯЗАТЕЛЕН. Раньше он был необязательным, и `/api/video-token`
   * его не передавал: поиск по id шёл `findByID` глобально, так что перебор
   * `?id=1..N` с любого тенантного домена выдавал embedId/CF-токен чужих
   * видео. Теперь видео другого тенанта неотличимо от несуществующего.
   */
  tenantId: number | string
}): Promise<VideoAccessResult> {
  const payload = await getPayload({ config: await config })
  const tenantId = String(videoIdOrSlug.tenantId)
  if (!tenantId) return { allowed: false, reason: 'not-found' }

  // 1) находим видео по id или slug — всегда в пределах тенанта
  let video: any = null
  try {
    if (videoIdOrSlug.id != null) {
      const found = await payload.findByID({
        collection: 'videos',
        id: videoIdOrSlug.id,
        depth: 1,
        overrideAccess: true,
      })
      // findByID не умеет where — сверяем тенант после выборки.
      video = relId(found?.tenant) === tenantId ? found : null
    } else if (videoIdOrSlug.slug) {
      const res = await payload.find({
        collection: 'videos',
        where: {
          and: [{ slug: { equals: videoIdOrSlug.slug } }, { tenant: { equals: videoIdOrSlug.tenantId } }],
        },
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

  // 2) Открыто всем БЕСПЛАТНО только если:
  //    - явно бесплатное превью (isPreview), ИЛИ
  //    - внешняя вставка без уровня (её и так нельзя закрыть подпиской).
  //    ВАЖНО: своё видео (наше хранилище) без minTier бесплатным НЕ считается —
  //    оно требует любую активную подписку, иначе автор раздаёт наши мощности
  //    даром. Раньше здесь было `!minTierId` для всех — это и была дыра.
  const isEmbed = video.provider === 'embed'
  const minTier = video.minTier
  const minTierId = minTier ? (typeof minTier === 'object' ? minTier.id : minTier) : null
  if (video.isPreview || (isEmbed && !minTierId)) {
    const subscriber = await getCurrentSubscriber(tenantId)
    return { allowed: true, video, subscriber }
  }

  // 3) нужна подписка — проверяем подписчика ЭТОГО ЖЕ тенанта
  const subscriber = await getCurrentSubscriber(tenantId)
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

  // Своё видео без заданного уровня: достаточно ЛЮБОЙ активной подписки
  // (подписка уже проверена выше — не истекла, подписчик не заблокирован).
  if (!minTierId) {
    return { allowed: true, video, subscriber }
  }

  // Подход Б: дочитываем веса обоих уровней из БД, оба — в пределах тенанта
  const [minWeight, activeWeight] = await Promise.all([
    tierWeight(payload, minTierId, tenantId),
    tierWeight(payload, activeTierId, tenantId),
  ])

  if (activeWeight == null || minWeight == null) {
    return { allowed: false, reason: 'need-subscription', video, requiredTierName }
  }

  if (activeWeight >= minWeight) {
    return { allowed: true, video, subscriber }
  }

  return { allowed: false, reason: 'need-subscription', video, requiredTierName }
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
