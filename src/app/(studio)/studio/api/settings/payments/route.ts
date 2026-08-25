import { withAuthor, apiError, authorCan } from '@/app/(studio)/studio/api/_lib'
import { NextResponse } from 'next/server'

/**
 * Платёжная информация для вкладки «Платежи» студии: сводка + последние платежи
 * подписок (subscription-payments). Owner/финансовое право (tiers.manage).
 *
 * GET → { summary: { succeededCount, sumRub, capped }, items: [...] }
 */
export const GET = withAuthor(async ({ payload, tenantId, author }) => {
  if (!authorCan(author, 'tiers', 'manage')) return apiError('Недостаточно прав', 403)

  const CAP = 1000
  const [succeeded, recent] = await Promise.all([
    payload.find({
      collection: 'subscription-payments',
      where: { and: [{ tenant: { equals: tenantId } }, { status: { equals: 'succeeded' } }] },
      sort: '-createdAt',
      limit: CAP,
      depth: 0,
      overrideAccess: true,
    }),
    payload.find({
      collection: 'subscription-payments',
      where: { tenant: { equals: tenantId } },
      sort: '-createdAt',
      limit: 50,
      depth: 1,
      overrideAccess: true,
    }),
  ])

  const sumRub = (succeeded.docs as any[]).reduce((acc, p) => acc + (Number(p.amountRub) || 0), 0)

  const items = (recent.docs as any[]).map((p) => {
    const sub = p.subscriber && typeof p.subscriber === 'object' ? p.subscriber : null
    const tier = p.tier && typeof p.tier === 'object' ? p.tier : null
    return {
      id: p.id,
      subscriberName: sub ? sub.displayName || sub.email || `#${sub.id}` : '—',
      tierName: tier ? tier.name || tier.slug || '—' : '—',
      amountRub: Number(p.amountRub) || 0,
      status: String(p.status || 'pending'),
      isRecurring: Boolean(p.isRecurring),
      yookassaPaymentId: p.yookassaPaymentId || null,
      date: p.createdAt || null,
    }
  })

  return NextResponse.json({
    summary: {
      succeededCount: succeeded.totalDocs || 0,
      sumRub,
      capped: (succeeded.totalDocs || 0) > CAP,
    },
    items,
  })
})
