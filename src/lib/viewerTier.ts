import { getPayload } from 'payload'
import config from '@/payload.config'
import { getCurrentSubscriber } from '@/lib/currentSubscriber'
import { tierWeight } from '@/lib/tierWeight'

/**
 * Вес доступа текущего зрителя — для фильтра и пометки «закрыто» в поиске.
 *
 * 0 — аноним/гость, заблокированный, истёкшая подписка или без активного
 * тарифа. Иначе — weight активного тарифа. Та же модель весов, что в
 * publicationAccess/videoAccess. Без этого viewerTier был захардкожен 0, и
 * платящий подписчик видел свой оплаченный контент в выдаче как «закрытый».
 *
 * tenantId обязателен: подписчик должен принадлежать тому же тенанту, иначе
 * подписка была бы кросс-тенантной (см. getCurrentSubscriber).
 */
export async function getViewerTierWeight(tenantId: string | number): Promise<number> {
  const subscriber = await getCurrentSubscriber(tenantId)
  if (!subscriber || subscriber.isBlocked) return 0

  const until = subscriber.subscriptionUntil ? new Date(subscriber.subscriptionUntil) : null
  if (!until || until.getTime() <= Date.now()) return 0

  const activeTier = subscriber.activeTier
  const activeTierId = activeTier
    ? typeof activeTier === 'object'
      ? activeTier.id
      : activeTier
    : null
  if (!activeTierId) return 0

  const payload = await getPayload({ config: await config })
  const w = await tierWeight(payload, activeTierId, tenantId)
  return typeof w === 'number' && w > 0 ? w : 0
}
