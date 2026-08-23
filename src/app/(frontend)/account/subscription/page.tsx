import React from 'react'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getCurrentSubscriber } from '@/lib/currentSubscriber'
import { getTenantFromHeaders } from '@/lib/tenant'
import { MySubscription } from './MySubscription'

/** Личный кабинет подписчика → «Моя подписка» (карточка, инфо, история, отмена). */
export const dynamic = 'force-dynamic'

export default async function SubscriptionPage() {
  const sub = await getCurrentSubscriber()
  if (!sub) return null
  const full = sub as any
  const payload = await getPayload({ config: await config })
  const tid = ((await getTenantFromHeaders()) as any)?.tenant?.id

  const activeUntil: string | null = full.subscriptionUntil || null
  const isActive = activeUntil ? new Date(activeUntil).getTime() > Date.now() : false

  let planName: string | null = null
  let priceRub: number | null = null
  const tierRef = full.activeTier
  const tierId = tierRef && typeof tierRef === 'object' ? tierRef.id : tierRef
  if (tierId && isActive) {
    if (tierRef && typeof tierRef === 'object' && tierRef.name) {
      planName = tierRef.name
      priceRub = Number(tierRef.priceRub) || null
    } else {
      const t = (await payload
        .findByID({ collection: 'subscription-tiers', id: tierId, depth: 0, overrideAccess: true })
        .catch(() => null)) as any
      if (t) {
        planName = t.name || null
        priceRub = Number(t.priceRub) || null
      }
    }
  }

  let payments: { id: string | number; date: string | null; amountRub: number; status: string }[] = []
  if (tid) {
    const res = (await payload
      .find({
        collection: 'subscription-payments' as any,
        where: { and: [{ tenant: { equals: tid } }, { subscriber: { equals: full.id } }] },
        sort: '-createdAt',
        limit: 50,
        depth: 0,
        overrideAccess: true,
      })
      .catch(() => ({ docs: [] }))) as any
    payments = (res.docs as any[]).map((p) => ({
      id: p.id,
      date: p.createdAt || null,
      amountRub: Number(p.amountRub) || 0,
      status: String(p.status || 'pending'),
    }))
  }

  return (
    <>
      <h1 style={{ fontSize: 26, color: 'var(--brand-text)', margin: '0 0 20px' }}>Моя подписка</h1>
      <MySubscription
        planName={planName}
        priceRub={priceRub}
        activeUntil={isActive ? activeUntil : null}
        autoRenew={!!full.autoRenew}
        cardLabel={full.cardLabel || null}
        subscriptionSince={full.subscriptionSince || null}
        payments={payments}
      />
    </>
  )
}
