import React from 'react'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { requireAuthor, contributorOwnerFilter } from '@/lib/currentAuthor'
import { loadEntitlements, canUse } from '@/lib/studioEntitlements'
import { StudioUpsell } from '../../_ui/StudioUpsell'
import { VideoEditor } from './VideoEditor'

/**
 * Страница редактирования одного видео (/studio/videos/<id>) — заменяет
 * прежнюю выдвижную панель. Табы (Обзор/Субтитры/Главы/Аналитика/Саммари)
 * рендерит клиентский VideoEditor. Здесь — загрузка данных с проверкой тенанта
 * и (для контрибьютора) владения.
 */
export const dynamic = 'force-dynamic'

export default async function VideoEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const author = await requireAuthor()
  const payload = await getPayload({ config: await config })
  const ent = await loadEntitlements(payload, author!.tenantId)
  if (!canUse(ent, 'media')) return <StudioUpsell cap="media" />

  const ownFilter = contributorOwnerFilter(author!, 'videos')

  const res = await payload.find({
    collection: 'videos',
    where: {
      and: [
        { id: { equals: id } },
        { tenant: { equals: author!.tenantId } },
        { provider: { not_equals: 'audio' } },
        ...(ownFilter ? [ownFilter] : []),
      ],
    },
    limit: 1,
    depth: 1,
    overrideAccess: true,
  })
  const v = (res.docs as any[])[0]
  if (!v) notFound()

  // Публикации, где это видео прикреплено (relatedVideos).
  const pubsRes = await payload.find({
    collection: 'publications',
    where: { and: [{ tenant: { equals: author!.tenantId } }, { relatedVideos: { in: [v.id] } }] },
    sort: '-publishedAt',
    limit: 200,
    depth: 0,
    overrideAccess: true,
  })
  const usedIn = (pubsRes.docs as any[]).map((p) => ({ id: p.id, title: p.title || 'Без заголовка' }))

  const video = {
    id: v.id,
    title: v.title || 'Без названия',
    provider: (v.provider as string) || 'stream',
    embedProvider: (v.embedProvider as string) || null,
    embedSrc: (v.embedSrc as string) || null,
    minTierId: v.minTier ? String(typeof v.minTier === 'object' ? v.minTier.id : v.minTier) : '',
    season: v.season ?? null,
    episode: v.episode ?? null,
    categoryId: v.category ? String(typeof v.category === 'object' ? v.category.id : v.category) : '',
    tags: Array.isArray(v.tags)
      ? (v.tags as any[]).map((t) => t?.label).filter((l): l is string => typeof l === 'string' && l.length > 0)
      : [],
    usedIn,
    playbackId: (v.playbackId as string) || null,
    subtitles: Array.isArray(v.subtitles)
      ? (v.subtitles as any[]).map((sx) => ({ lang: String(sx.lang || ''), label: String(sx.label || sx.lang || ''), at: sx.at ? String(sx.at) : undefined, v: sx.v != null ? Number(sx.v) : undefined })).filter((sx) => sx.lang)
      : [],
    summary: (v as any).summary ?? null,
    chapters: Array.isArray((v as any).chapters)
      ? ((v as any).chapters as any[]).map((c) => ({ start: Number(c?.start) || 0, title: String(c?.title || '') })).filter((c) => c.title)
      : [],
  }

  const tiersRes = await payload.find({
    collection: 'subscription-tiers',
    where: { tenant: { equals: author!.tenantId } },
    sort: 'weight',
    limit: 100,
    depth: 0,
    overrideAccess: true,
  })
  const tiers = (tiersRes.docs as any[]).map((t) => ({ id: t.id, name: t.name || t.slug || `Уровень ${t.id}` }))

  return <VideoEditor video={video} tiers={tiers} />
}
