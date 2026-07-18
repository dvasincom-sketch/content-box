import React from 'react'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getCurrentAuthor } from '@/lib/currentAuthor'
import { VideosManager } from './VideosManager'

/**
 * Экран «Видео» студии. Таблица видео тенанта + папки (дерево) + добавление.
 * Статус кодирования подтягивается клиентом с роута status.
 */
export const dynamic = 'force-dynamic'

export default async function VideosPage() {
  const author = await getCurrentAuthor()
  const payload = await getPayload({ config: await config })

  const res = await payload.find({
    collection: 'videos',
    where: { tenant: { equals: author!.tenantId } },
    sort: '-createdAt',
    limit: 500,
    depth: 1,
    overrideAccess: true,
  })

  const videos = (res.docs as any[]).map((v) => ({
    id: v.id,
    title: v.title || 'Без названия',
    videoRef: v.videoRef || null,
    isPreview: Boolean(v.isPreview),
    minTierName:
      v.minTier && typeof v.minTier === 'object' ? v.minTier.name || v.minTier.slug : null,
    minTierId: v.minTier
      ? String(typeof v.minTier === 'object' ? v.minTier.id : v.minTier)
      : '',
    durationSec: v.durationSec || null,
    coverUrl: v.cover && typeof v.cover === 'object' ? v.cover.url : null,
    folderId: v.folder ? (typeof v.folder === 'object' ? v.folder.id : v.folder) : null,
    addedAt: v.publishedAt || v.createdAt || null,
  }))

  // уровни подписки для селектора доступа
  const tiersRes = await payload.find({
    collection: 'subscription-tiers',
    where: { tenant: { equals: author!.tenantId } },
    sort: 'weight',
    limit: 100,
    depth: 0,
    overrideAccess: true,
  })
  const tiers = (tiersRes.docs as any[]).map((t) => ({
    id: t.id,
    name: t.name || t.slug || `Уровень ${t.id}`,
  }))

  // Папки (дерево). parent придёт как id при depth:0 — строим дерево на клиенте.
  const foldersRes = await payload.find({
    collection: 'video-folders',
    where: { tenant: { equals: author!.tenantId } },
    sort: 'title',
    limit: 1000,
    depth: 0,
    overrideAccess: true,
  })
  const folders = (foldersRes.docs as any[]).map((f) => {
    const rawParent = f.parent
    const parentId =
      rawParent && typeof rawParent === 'object' ? rawParent.id : (rawParent ?? null)
    return {
      id: f.id,
      title: f.title || 'Без названия',
      parentId: parentId ?? null,
    }
  })

  return <VideosManager initialVideos={videos} tiers={tiers} folders={folders} />
}
