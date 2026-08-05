import React from 'react'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getCurrentAuthor, contributorOwnerFilter } from '@/lib/currentAuthor'
import { loadEntitlements, canUse } from '@/lib/studioEntitlements'
import { StudioUpsell } from '../_ui/StudioUpsell'
import { DownloadsManager } from './DownloadsManager'

/** Раздел «Файлы» студии (Медиа) — цифровые товары для скачивания по подписке. */
export const dynamic = 'force-dynamic'

export default async function DownloadsPage() {
  const author = await getCurrentAuthor()
  const ownFilter = contributorOwnerFilter(author!)
  const payload = await getPayload({ config: await config })
  const ent = await loadEntitlements(payload, author!.tenantId)
  if (!canUse(ent, 'media')) return <StudioUpsell cap="media" />

  const res = await payload.find({
    collection: 'downloads' as any,
    where: { and: [{ tenant: { equals: author!.tenantId } }, ...(ownFilter ? [ownFilter] : [])] },
    sort: '-createdAt',
    limit: 500,
    depth: 1,
    overrideAccess: true,
  })

  const items = (res.docs as any[]).map((d) => ({
    id: d.id,
    title: d.title || 'Без названия',
    description: d.description || '',
    filename: d.filename || null,
    mimeType: d.mimeType || null,
    filesize: typeof d.filesize === 'number' ? d.filesize : null,
    minTierName: d.minTier && typeof d.minTier === 'object' ? d.minTier.name || d.minTier.slug : null,
    minTierId: d.minTier ? String(typeof d.minTier === 'object' ? d.minTier.id : d.minTier) : '',
    isPreview: Boolean(d.isPreview),
    addedAt: d.publishedAt || d.createdAt || null,
    categoryId: d.category ? String(typeof d.category === 'object' ? d.category.id : d.category) : '',
  }))

  const tiersRes = await payload.find({
    collection: 'subscription-tiers',
    where: { tenant: { equals: author!.tenantId } },
    sort: 'weight', limit: 100, depth: 0, overrideAccess: true,
  })
  const tiers = (tiersRes.docs as any[]).map((t) => ({ id: t.id, name: t.name || t.slug || `Уровень ${t.id}` }))

  const catsRes = await payload.find({
    collection: 'categories',
    where: { tenant: { equals: author!.tenantId } },
    sort: 'title', limit: 1000, depth: 0, overrideAccess: true,
  })
  const categories = (catsRes.docs as any[]).map((c) => ({
    id: c.id,
    title: c.title || 'Без названия',
    parentId: c.parent ? (typeof c.parent === 'object' ? Number(c.parent.id) : Number(c.parent)) : null,
  }))

  return <DownloadsManager initialItems={items} tiers={tiers} categories={categories} />
}
