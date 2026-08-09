import React from 'react'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { requireAuthor, contributorOwnerFilter } from '@/lib/currentAuthor'
import { can } from '@/access'
import { loadEntitlements, canUse } from '@/lib/studioEntitlements'
import { StudioUpsell } from '../_ui/StudioUpsell'
import { VideosManager } from './VideosManager'

/**
 * Экран «Видео» студии. Таблица видео тенанта + папки (дерево) + добавление.
 * Статус кодирования подтягивается клиентом с роута status.
 */
export const dynamic = 'force-dynamic'

export default async function VideosPage() {
  const author = await requireAuthor()
  const ownFilter = contributorOwnerFilter(author!, 'videos')
  const payload = await getPayload({ config: await config })
  const ent = await loadEntitlements(payload, author!.tenantId)
  if (!canUse(ent, 'media')) return <StudioUpsell cap="media" />

  const res = await payload.find({
    collection: 'videos',
    where: { and: [{ tenant: { equals: author!.tenantId } }, { provider: { not_equals: 'audio' } }, ...(ownFilter ? [ownFilter] : [])] },
    sort: '-createdAt',
    limit: 500,
    depth: 1,
    overrideAccess: true,
  })

  // Один запрос: все публикации тенанта с их relatedVideos. Строим карту
  // videoId → [{ id, title }] публикаций, где это видео прикреплено. Так не
  // делаем N запросов на каждое видео.
  const pubsRes = await payload.find({
    collection: 'publications',
    where: { tenant: { equals: author!.tenantId } },
    sort: '-publishedAt',
    limit: 1000,
    depth: 0,
    overrideAccess: true,
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

  const videos = (res.docs as any[]).map((v) => ({
    id: v.id,
    title: v.title || 'Без названия',
    videoRef: v.videoRef || null,
    // Нужен клиенту: у внешней вставки нет файла в хранилище, поэтому опрос
    // готовности кодирования к ней неприменим — иначе видео вечно висит в
    // статусе «нет файла» и превью недоступно.
    provider: (v.provider as string) || 'stream',
    // Внешняя вставка: нужно клиенту, чтобы дать редактировать ссылку
    // ошибочного embed-видео (перербор на сервере).
    embedProvider: (v.embedProvider as string) || null,
    embedSrc: (v.embedSrc as string) || null,
    embedAspect: (v.embedAspect as string) || null,
    // Статус доступности внешней вставки (VK): нужен клиенту для бейджа
    // «недоступно» и фильтра битых видео.
    embedStatus: (v.embedStatus as string) || null,
    // Статус обработки своего видео (self): uploading|processing|ready|error.
    assetStatus: (v.assetStatus as string) || null,
    isPreview: Boolean(v.isPreview),
    minTierName:
      v.minTier && typeof v.minTier === 'object' ? v.minTier.name || v.minTier.slug : null,
    minTierId: v.minTier
      ? String(typeof v.minTier === 'object' ? v.minTier.id : v.minTier)
      : '',
    durationSec: v.durationSec || null,
    coverUrl: videoThumbUrl(v),
    addedAt: v.publishedAt || v.createdAt || null,
    season: v.season ?? null,
    episode: v.episode ?? null,
    categoryId: v.category ? String(typeof v.category === 'object' ? v.category.id : v.category) : '',
    tags: Array.isArray(v.tags)
      ? (v.tags as any[]).map((t) => t?.label).filter((l): l is string => typeof l === 'string' && l.length > 0)
      : [],
    usedIn: usedInByVideo.get(String(v.id)) || [],
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

  // Категории тенанта (id, title, parentId) — для колонки «Раздел» и фильтра
  // по разделам «Смотреть». Дерево строим на клиенте по parentId.
  const catsRes = await payload.find({
    collection: 'categories',
    where: { tenant: { equals: author!.tenantId } },
    sort: 'title',
    limit: 1000,
    depth: 0,
    overrideAccess: true,
  })
  const categories = (catsRes.docs as any[]).map((c) => {
    const rawParent = c.parent
    const parentId =
      rawParent && typeof rawParent === 'object' ? rawParent.id : (rawParent ?? null)
    return {
      id: c.id,
      title: c.title || 'Без названия',
      parentId: parentId ?? null,
    }
  })

  return <VideosManager initialVideos={videos} tiers={tiers} categories={categories}  canCreate={can(author!.user as any, 'videos', 'create')} />
}
