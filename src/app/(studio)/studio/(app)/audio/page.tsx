import React from 'react'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { requireAuthor, contributorOwnerFilter } from '@/lib/currentAuthor'
import { can } from '@/access'
import { loadEntitlements, canUse } from '@/lib/studioEntitlements'
import { StudioUpsell } from '../_ui/StudioUpsell'
import { AudioManager } from './AudioManager'

/** Раздел «Аудио» студии (Медиа). Аудио — записи videos с provider='audio'. */
export const dynamic = 'force-dynamic'

export default async function AudioPage() {
  const author = await requireAuthor()
  const ownFilter = contributorOwnerFilter(author!, 'videos')
  const payload = await getPayload({ config: await config })
  const ent = await loadEntitlements(payload, author!.tenantId)
  if (!canUse(ent, 'media')) return <StudioUpsell cap="media" />

  const res = await payload.find({
    collection: 'videos',
    where: { and: [{ tenant: { equals: author!.tenantId } }, { provider: { equals: 'audio' } }, ...(ownFilter ? [ownFilter] : [])] },
    sort: '-createdAt',
    limit: 500,
    depth: 1,
    overrideAccess: true,
  })

  // Где аудио прикреплено к публикациям (для окна редактирования / блокировки удаления).
  const pubsRes = await payload.find({
    collection: 'publications',
    where: { tenant: { equals: author!.tenantId } },
    sort: '-publishedAt', limit: 1000, depth: 0, overrideAccess: true,
  })
  const usedInByVideo = new Map<string, { id: number | string; title: string }[]>()
  for (const p of pubsRes.docs as any[]) {
    const related = Array.isArray(p.relatedVideos) ? p.relatedVideos : []
    for (const rv of related) {
      const vid = String(typeof rv === 'object' ? rv.id : rv)
      if (!usedInByVideo.has(vid)) usedInByVideo.set(vid, [])
      usedInByVideo.get(vid)!.push({ id: p.id, title: p.title || 'Без заголовка' })
    }
  }

  const audios = (res.docs as any[]).map((v) => ({
    id: v.id,
    title: v.title || 'Без названия',
    slug: v.slug || null,
    minTierName: v.minTier && typeof v.minTier === 'object' ? v.minTier.name || v.minTier.slug : null,
    minTierId: v.minTier ? String(typeof v.minTier === 'object' ? v.minTier.id : v.minTier) : '',
    isPreview: Boolean(v.isPreview),
    addedAt: v.publishedAt || v.createdAt || null,
    season: v.season ?? null,
    episode: v.episode ?? null,
    categoryId: v.category ? String(typeof v.category === 'object' ? v.category.id : v.category) : '',
    tags: Array.isArray(v.tags)
      ? (v.tags as any[]).map((t) => t?.label).filter((l): l is string => typeof l === 'string' && l.length > 0)
      : [],
    usedIn: usedInByVideo.get(String(v.id)) || [],
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

  return <AudioManager initialAudios={audios} tiers={tiers} categories={categories}  canCreate={can(author!.user as any, 'videos', 'create')} />
}
