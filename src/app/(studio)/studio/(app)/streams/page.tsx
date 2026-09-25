import React from 'react'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { requireAuthor } from '@/lib/currentAuthor'
import { redirect } from 'next/navigation'
import { StreamsManager } from './StreamsManager'

/** Раздел «Трансляции» студии (Медиа) — прямые эфиры Castr. Только владелец. */
export const dynamic = 'force-dynamic'

export default async function StreamsPage() {
  const author = await requireAuthor()
  const isOwner = (author!.user as { tenantRole?: string | null }).tenantRole !== 'contributor'
  if (!isOwner) redirect('/studio')

  const payload = await getPayload({ config: await config })
  const tiersRes = await payload.find({
    collection: 'subscription-tiers',
    where: { and: [{ tenant: { equals: author!.tenantId } }, { isActive: { equals: true } }] },
    sort: 'weight',
    limit: 100,
    depth: 0,
    overrideAccess: true,
  })
  const tiers = (tiersRes.docs as any[]).map((t) => ({ id: String(t.id), name: t.name || t.slug || `Уровень ${t.id}` }))

  return <StreamsManager tiers={tiers} />
}
