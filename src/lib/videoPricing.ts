import type { Payload } from 'payload'

/**
 * Минимальная цена подписки, если у автора есть загруженное видео (provider='self').
 * Своё видео нельзя выкладывать бесплатно (оно занимает наше хранилище и
 * обработку), и нельзя обойти правило дешёвым тарифом в 1 ₽ — поэтому пол 300 ₽/мес.
 */
export const MIN_VIDEO_TIER_PRICE = 300

/** Есть ли у тенанта хотя бы одно своё видео (в хранилище). */
export async function tenantHasSelfVideo(payload: Payload, tenantId: number | string): Promise<boolean> {
  const res = await payload.find({
    collection: 'videos',
    where: { and: [{ tenant: { equals: tenantId } }, { provider: { equals: 'self' } }] },
    limit: 0,
    depth: 0,
    overrideAccess: true,
  })
  return res.totalDocs > 0
}

/** Цена уровня подписки (priceRub) по id, в пределах тенанта. null, если не найден. */
export async function tierPrice(
  payload: Payload,
  tierId: number | string,
  tenantId: number | string,
): Promise<number | null> {
  try {
    const doc: any = await payload.findByID({ collection: 'subscription-tiers', id: tierId, depth: 0, overrideAccess: true })
    const t = doc?.tenant && typeof doc.tenant === 'object' ? doc.tenant.id : doc?.tenant
    if (Number(t) !== Number(tenantId)) return null
    return Number(doc?.priceRub ?? 0)
  } catch {
    return null
  }
}
