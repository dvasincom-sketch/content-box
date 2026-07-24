import { NextResponse } from 'next/server'
import { withAuthor, readJson, apiError, apiOk } from '@/app/(studio)/studio/api/_lib'
import { slugify } from '@/lib/slugify'
import { kinescopeGetVideo } from '@/lib/kinescope'

/**
 * Импорт уже загруженного в Kinescope видео в студию: создаём запись Videos с
 * provider='kinescope' и videoRef=<video_id>, без повторной загрузки в Kinescope.
 *
 * Поток: авторизация → защита от дубля (тот же videoRef в тенанте) →
 * kinescopeGetVideo (проверка существования + метаданные: название, длительность)
 * → создание записи. Название/категория/папка/уровень — из тела (опц.).
 *
 * Body: { videoId, title?, categoryId?, folderId?, minTierId?, isPreview? }
 */
export const runtime = 'nodejs'

export const POST = withAuthor(async ({ req, payload, tenantId }) => {
  const data = await readJson(req)
  if (data === undefined) return apiError('Некорректный запрос')

  const videoId = String(data.videoId || '').trim()
  if (!videoId) return apiError('Не передан id видео')

  // 1) Защита от дубля: это видео уже в студии?
  const dup = await payload.find({
    collection: 'videos',
    where: {
      and: [
        { tenant: { equals: tenantId } },
        { provider: { equals: 'kinescope' } },
        { videoRef: { equals: videoId } },
      ],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  if (dup.docs.length > 0) {
    return NextResponse.json(
      { error: 'Это видео уже добавлено в студию.', id: (dup.docs[0] as any).id },
      { status: 409 },
    )
  }

  // 2) Проверяем в Kinescope + берём метаданные
  let meta
  try {
    meta = await kinescopeGetVideo(videoId)
  } catch (e: any) {
    return apiError(`Kinescope: ${e?.message || 'видео не найдено'}`, 502)
  }

  // 3) Создаём запись Videos
  const title =
    String(data.title || meta.title || '').trim() || `Видео ${videoId.slice(0, 8)}`
  try {
    const doc = await payload.create({
      collection: 'videos',
      data: {
        title,
        slug: slugify(title) || videoId,
        provider: 'kinescope',
        videoRef: videoId,
        durationSec:
          typeof meta.duration === 'number' ? Math.round(meta.duration) : undefined,
        minTier: numOrNull(data.minTierId),
        isPreview: Boolean(data.isPreview),
        category: numOrNull(data.categoryId),
        folder: numOrNull(data.folderId),
        tenant: tenantId,
      } as any,
      overrideAccess: true,
    })
    return apiOk({ id: doc.id, videoId, ready: meta.ready })
  } catch (e: any) {
    return apiError(e?.message || 'Не удалось создать запись видео', 500)
  }
})

function numOrNull(v: any): number | null {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
