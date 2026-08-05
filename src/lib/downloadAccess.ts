import { getPayload } from 'payload'
import config from '@/payload.config'
import { getCurrentSubscriber } from '@/lib/currentSubscriber'
import { tierWeight } from '@/lib/tierWeight'

/**
 * Проверка доступа подписчика к файлу («Файлы»/downloads) — та же логика
 * гейтинга, что и у видео (см. videoAccess.ts):
 *  1) isPreview === true  — бесплатно для всех;
 *  2) minTier пусто       — бесплатно для всех;
 *  3) активная подписка достаточного уровня (weight(active) >= weight(min)).
 *
 * Тенант обязателен: поиск всегда в его пределах, чтобы перебор `?id=1..N` с
 * чужого домена не выдавал файлы другого тенанта.
 *
 * Возвращает { allowed:true, doc } или { allowed:false, reason, requiredTierName? }.
 */

export type DownloadAccessResult =
  | { allowed: true; doc: any; subscriber: any | null }
  | {
      allowed: false
      reason: 'not-found' | 'need-login' | 'need-subscription' | 'expired' | 'blocked'
      doc?: any
      requiredTierName?: string | null
    }

export async function checkDownloadAccess(input: {
  id?: string | number
  slug?: string
  tenantId: number | string
}): Promise<DownloadAccessResult> {
  const payload = await getPayload({ config: await config })
  const tenantId = String(input.tenantId)
  if (!tenantId) return { allowed: false, reason: 'not-found' }

  // 1) находим файл строго в пределах тенанта
  let doc: any = null
  try {
    if (input.id != null) {
      const found = await payload.findByID({
        collection: 'downloads' as any,
        id: input.id,
        depth: 1,
        overrideAccess: true,
      })
      doc = relId((found as any)?.tenant) === tenantId ? found : null
    }
  } catch {
    doc = null
  }

  if (!doc) return { allowed: false, reason: 'not-found' }

  // 2) бесплатное превью или без minTier — открыто всем
  const minTier = doc.minTier
  const minTierId = minTier ? (typeof minTier === 'object' ? minTier.id : minTier) : null
  if (doc.isPreview || !minTierId) {
    const subscriber = await getCurrentSubscriber(tenantId)
    return { allowed: true, doc, subscriber }
  }

  // 3) нужна подписка — проверяем подписчика этого же тенанта
  const subscriber = await getCurrentSubscriber(tenantId)
  const requiredTierName =
    minTier && typeof minTier === 'object' ? minTier.name || minTier.slug : null

  if (!subscriber) return { allowed: false, reason: 'need-login', doc, requiredTierName }
  if (subscriber.isBlocked) return { allowed: false, reason: 'blocked', doc, requiredTierName }

  const until = subscriber.subscriptionUntil ? new Date(subscriber.subscriptionUntil) : null
  if (!until || until.getTime() <= Date.now()) {
    return { allowed: false, reason: 'expired', doc, requiredTierName }
  }

  const activeTier = subscriber.activeTier
  const activeTierId = activeTier ? (typeof activeTier === 'object' ? activeTier.id : activeTier) : null
  if (!activeTierId) return { allowed: false, reason: 'need-subscription', doc, requiredTierName }

  const [minWeight, activeWeight] = await Promise.all([
    tierWeight(payload, minTierId, tenantId),
    tierWeight(payload, activeTierId, tenantId),
  ])
  if (activeWeight == null || minWeight == null) {
    return { allowed: false, reason: 'need-subscription', doc, requiredTierName }
  }
  if (activeWeight >= minWeight) return { allowed: true, doc, subscriber }

  return { allowed: false, reason: 'need-subscription', doc, requiredTierName }
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
