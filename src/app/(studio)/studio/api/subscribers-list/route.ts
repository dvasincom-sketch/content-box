import { withAuthor, apiError, apiOk, isContributor } from '@/app/(studio)/studio/api/_lib'

/**
 * Список пользователей (подписчиков) тенанта для дашборда — прозрачность данных.
 * Только владелец студии. Возвращает базовые поля без чувствительных токенов.
 */
export const GET = withAuthor(async ({ payload, tenantId, author }) => {
  if (isContributor(author)) return apiError('Доступно только владельцу студии', 403)
  const res = await payload.find({
    collection: 'subscribers',
    where: { tenant: { equals: tenantId } },
    sort: '-createdAt',
    limit: 1000,
    depth: 1,
    overrideAccess: true,
  })
  const users = (res.docs as any[]).map((u) => {
    const tier = u.activeTier && typeof u.activeTier === 'object' ? u.activeTier : null
    const until = u.subscriptionUntil ? new Date(u.subscriptionUntil).getTime() : 0
    const paid = Boolean(tier) && (!u.subscriptionUntil || until > Date.now())
    return {
      id: u.id,
      email: u.email as string,
      displayName: (u.displayName as string) || '',
      tierName: tier ? (tier.name || tier.slug || null) : null,
      paid,
      isBlocked: Boolean(u.isBlocked),
      subscriptionUntil: u.subscriptionUntil || null,
      createdAt: u.createdAt || null,
    }
  })
  return apiOk({ users, total: res.totalDocs })
})
