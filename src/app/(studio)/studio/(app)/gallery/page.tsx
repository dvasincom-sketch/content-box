import React from 'react'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { requireAuthor } from '@/lib/currentAuthor'
import { can } from '@/access'
import { loadEntitlements, canUse } from '@/lib/studioEntitlements'
import { StudioUpsell } from '../_ui/StudioUpsell'
import { GalleryLibrary } from './GalleryLibrary'

/** Раздел «Галерея» студии (Медиа) — общая библиотека изображений тенанта. */
export const dynamic = 'force-dynamic'

export default async function GalleryPage() {
  const author = await requireAuthor()
  const payload = await getPayload({ config: await config })
  const ent = await loadEntitlements(payload, author!.tenantId)
  if (!canUse(ent, 'media')) return <StudioUpsell cap="media" />

  const foldersRes = await payload.find({
    collection: 'gallery-folders',
    where: { tenant: { equals: author!.tenantId } },
    sort: 'title', limit: 1000, depth: 0, overrideAccess: true,
  })
  const folders = (foldersRes.docs as any[]).map((f) => ({
    id: f.id,
    title: f.title || 'Без названия',
    parentId: f.parent ? (typeof f.parent === 'object' ? f.parent.id : f.parent) : null,
  }))

  return <GalleryLibrary folders={folders}  canCreate={can(author!.user as any, 'gallery', 'create')} />
}
