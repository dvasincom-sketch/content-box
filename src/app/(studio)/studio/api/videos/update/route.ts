import { NextResponse, type NextRequest } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getCurrentAuthor } from '@/lib/currentAuthor'

/**
 * Обновить название и уровень доступа видео.
 *
 * Body: { videoId, title, minTierId }
 *  - title:     непустая строка → новое название видео
 *  - minTierId: число → уровень доступа (проверяется на тенант)
 *               null / '' → снять уровень (доступно всем / minTier → null)
 *
 * По образцу set-folder: авторизация → проверка принадлежности видео тенанту →
 * проверка целевого уровня на тенант → payload.update.
 */
export async function POST(req: NextRequest) {
  const author = await getCurrentAuthor()
  if (!author) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  let data: any
  try {
    data = await req.json()
  } catch {
    return NextResponse.json({ error: 'Некорректный запрос' }, { status: 400 })
  }

  const videoId = data.videoId
  if (!videoId) return NextResponse.json({ error: 'Не указано видео' }, { status: 400 })

  const title = typeof data.title === 'string' ? data.title.trim() : ''
  if (!title) return NextResponse.json({ error: 'Укажите название' }, { status: 400 })

  const payload = await getPayload({ config: await config })
  const tenantId = author.tenantId

  // Видео принадлежит тенанту?
  const video: any = await payload
    .findByID({ collection: 'videos', id: videoId, depth: 0, overrideAccess: true })
    .catch(() => null)
  if (!video) return NextResponse.json({ error: 'Видео не найдено' }, { status: 404 })
  const vTenant =
    video.tenant && typeof video.tenant === 'object' ? video.tenant.id : video.tenant
  if (Number(vTenant) !== Number(tenantId)) {
    return NextResponse.json({ error: 'Видео не найдено' }, { status: 404 })
  }

  // Целевой уровень доступа
  let minTier: number | null = null
  if (data.minTierId != null && data.minTierId !== '') {
    const t: any = await payload
      .findByID({
        collection: 'subscription-tiers',
        id: data.minTierId,
        depth: 0,
        overrideAccess: true,
      })
      .catch(() => null)
    const tTenant = t && (typeof t.tenant === 'object' ? t.tenant.id : t.tenant)
    if (!t || Number(tTenant) !== Number(tenantId)) {
      return NextResponse.json({ error: 'Уровень не найден' }, { status: 400 })
    }
    minTier = Number(data.minTierId)
  }

  try {
    await payload.update({
      collection: 'videos',
      id: videoId,
      data: { title, minTier } as any,
      overrideAccess: true,
    })
    return NextResponse.json({ ok: true, title, minTierId: minTier })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Не удалось обновить видео' },
      { status: 400 },
    )
  }
}
