import { withAuthor, readJson, apiError, apiOk, canMutateDoc } from '@/app/(studio)/studio/api/_lib'
import { errorMessage } from '@/lib/errorMessage'

/**
 * Назначить / снять папку у видео.
 *
 * Body: { videoId, folderId }
 *  - folderId: число → положить видео в эту папку (папка проверяется на тенант)
 *              null / '' → вынуть из папки (folder → null)
 *
 * Одно видео = одна папка, поэтому просто перезаписываем поле folder.
 */
export const POST = withAuthor(async ({ req, payload, tenantId, author }) => {
  const data = await readJson(req)
  if (data === undefined) return apiError('Некорректный запрос')

  const videoId = data.videoId
  if (!(await canMutateDoc(payload, 'videos', videoId, author, 'videos', 'edit'))) return apiError('Недостаточно прав', 403)
  if (!videoId) return apiError('Не указано видео')

  // Видео принадлежит тенанту?
  const video: any = await payload
    .findByID({ collection: 'videos', id: videoId, depth: 0, overrideAccess: true })
    .catch(() => null)
  if (!video) return apiError('Видео не найдено', 404)
  const vTenant =
    video.tenant && typeof video.tenant === 'object' ? video.tenant.id : video.tenant
  if (Number(vTenant) !== Number(tenantId)) {
    return apiError('Видео не найдено', 404)
  }

  // Целевая папка
  let folder: number | null = null
  if (data.folderId != null && data.folderId !== '') {
    const f: any = await payload
      .findByID({ collection: 'video-folders', id: data.folderId, depth: 0, overrideAccess: true })
      .catch(() => null)
    const fTenant = f && (typeof f.tenant === 'object' ? f.tenant.id : f.tenant)
    if (!f || Number(fTenant) !== Number(tenantId)) {
      return apiError('Папка не найдена')
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
    return apiOk({ folderId: folder })
  } catch (e: unknown) {
    return apiError(errorMessage(e, 'Не удалось изменить папку видео'))
  }
})
