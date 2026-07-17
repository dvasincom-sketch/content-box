import { NextResponse, type NextRequest } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getCurrentAuthor } from '@/lib/currentAuthor'

/**
 * Назначить / снять папку у видео.
 *
 * Body: { videoId, folderId }
 *  - folderId: число → положить видео в эту папку (папка проверяется на тенант)
 *              null / '' → вынуть из папки (folder → null)
 *
 * Одно видео = одна папка, поэтому просто перезаписываем поле folder.
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

  // Целевая папка
  let folder: number | null = null
  if (data.folderId != null && data.folderId !== '') {
    const f: any = await payload
      .findByID({ collection: 'video-folders', id: data.folderId, depth: 0, overrideAccess: true })
      .catch(() => null)
    const fTenant = f && (typeof f.tenant === 'object' ? f.tenant.id : f.tenant)
    if (!f || Number(fTenant) !== Number(tenantId)) {
      return NextResponse.json({ error: 'Папка не найдена' }, { status: 400 })
    }
    folder = Number(data.folderId)
  }

  try {
    await payload.update({
      collection: 'videos',
      id: videoId,
      data: { folder } as any,
      overrideAccess: true,
    })
    return NextResponse.json({ ok: true, folderId: folder })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Не удалось изменить папку видео' },
      { status: 400 },
    )
  }
}
