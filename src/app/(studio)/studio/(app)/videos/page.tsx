import React from 'react'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { videoThumbUrl, videoGifUrl } from '@/lib/videoThumb'
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

  // Общие фрагменты where. «Проблемные» — та же логика, что у бейджа в меню и у
  // videoState в списке: broken = недоступный embed ИЛИ своё видео с ошибкой;
  // processing = своё видео в загрузке/обработке.
  const tenantWhere = { tenant: { equals: author!.tenantId } }
  const notAudio = { provider: { not_equals: 'audio' } }
  const ownArr = ownFilter ? [ownFilter] : []
  const brokenWhere = {
    or: [
      { embedStatus: { equals: 'unavailable' } },
      { and: [{ provider: { equals: 'self' } }, { assetStatus: { equals: 'error' } }] },
    ],
  }
  const processingWhere = {
    and: [{ provider: { equals: 'self' } }, { assetStatus: { in: ['uploading', 'processing'] } }],
  }

  // Список грузим постранично-урезанно (500 новейших), НО счётчики считаем по
  // ВСЕЙ библиотеке (count), чтобы «Всего» и «Проблемные» не расходились с
  // бейджем в меню. Плюс отдельно тянем ВСЕ проблемные видео и подмешиваем в
  // список — тогда фильтр «Проблемные» показывает их полностью, а не только те,
  // что попали в 500 новейших.
  const [res, problemRes, totalCountRes, brokenCountRes, processingCountRes] = await Promise.all([
    payload.find({
      collection: 'videos',
      where: { and: [tenantWhere, notAudio, ...ownArr] },
      sort: '-createdAt',
      limit: 500,
      depth: 1,
      overrideAccess: true,
    }),
    payload.find({
      collection: 'videos',
      where: { and: [tenantWhere, notAudio, ...ownArr, { or: [brokenWhere, processingWhere] }] },
      sort: '-createdAt',
      limit: 2000,
      depth: 1,
      overrideAccess: true,
    }),
    payload.count({ collection: 'videos', where: { and: [tenantWhere, notAudio, ...ownArr] }, overrideAccess: true }),
    payload.count({ collection: 'videos', where: { and: [tenantWhere, notAudio, ...ownArr, brokenWhere] }, overrideAccess: true }),
    payload.count({ collection: 'videos', where: { and: [tenantWhere, notAudio, ...ownArr, processingWhere] }, overrideAccess: true }),
  ])
  const totalCount = totalCountRes.totalDocs || 0
  const brokenTotal = brokenCountRes.totalDocs || 0
  const processingTotal = processingCountRes.totalDocs || 0

  // Мердж: 500 новейших + все проблемные (без дублей).
  const seenIds = new Set((res.docs as any[]).map((d) => String(d.id)))
  const allDocs = [
    ...(res.docs as any[]),
    ...(problemRes.docs as any[]).filter((d) => !seenIds.has(String(d.id))),
  ]

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

  const videos = allDocs.map((v) => ({
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
    assetBytes: (v as any).assetBytes || null,
    coverUrl: videoThumbUrl(v),
    previewGif: videoGifUrl(v),
    addedAt: v.publishedAt || v.createdAt || null,
    episode: v.episode ?? null,
    categoryId: v.category ? String(typeof v.category === 'object' ? v.category.id : v.category) : '',
    tags: Array.isArray(v.tags)
      ? (v.tags as any[]).map((t) => t?.label).filter((l): l is string => typeof l === 'string' && l.length > 0)
      : [],
    usedIn: usedInByVideo.get(String(v.id)) || [],
    playbackId: (v.playbackId as string) || null,
    subtitles: Array.isArray(v.subtitles)
      ? (v.subtitles as any[]).map((sx) => ({ lang: String(sx.lang || ''), label: String(sx.label || sx.lang || '') })).filter((sx) => sx.lang)
      : [],
    summary: (v as any).summary ?? null,
    chapters: Array.isArray((v as any).chapters)
      ? ((v as any).chapters as any[]).map((c) => ({ start: Number(c?.start) || 0, title: String(c?.title || '') })).filter((c) => c.title)
      : [],
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

  return (
    <VideosManager
      initialVideos={videos}
      totalCount={totalCount}
      brokenTotal={brokenTotal}
      processingTotal={processingTotal}
      tiers={tiers}
      categories={categories}
      canCreate={can(author!.user as any, 'videos', 'create')}
    />
  )
}
