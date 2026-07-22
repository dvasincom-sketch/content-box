import { NextResponse, type NextRequest } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getCurrentAuthor } from '@/lib/currentAuthor'
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

export async function POST(req: NextRequest) {
  const author = await getCurrentAuthor()
  if (!author) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  let data: any
  try {
    data = await req.json()
  } catch {
    return NextResponse.json({ error: 'Некорректный запрос' }, { status: 400 })
  }

  const videoId = String(data.videoId || '').trim()
  if (!videoId) return NextResponse.json({ error: 'Не передан id видео' }, { status: 400 })

  const payload = await getPayload({ config: await config })

  // 1) Защита от дубля: это видео уже в студии?
  const dup = await payload.find({
    collection: 'videos',
    where: {
      and: [
        { tenant: { equals: author.tenantId } },
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
    return NextResponse.json(
      { error: `Kinescope: ${e?.message || 'видео не найдено'}` },
      { status: 502 },
    )
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
        tenant: author.tenantId,
      } as any,
      overrideAccess: true,
    })
    return NextResponse.json({ ok: true, id: doc.id, videoId, ready: meta.ready })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Не удалось создать запись видео' },
      { status: 500 },
    )
  }
}

function numOrNull(v: any): number | null {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
