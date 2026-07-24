import { withAuthor, readJson, apiError, apiOk } from '@/app/(studio)/studio/api/_lib'

/**
 * Назначить / снять папку у изображения галереи.
 *
 * Body: { imageId, folderId }
 *  - folderId: число → положить изображение в эту папку (папка проверяется на тенант)
 *              null / '' → вынуть из папки (folder → null)
 *
 * Одно видео = одна папка, поэтому просто перезаписываем поле folder.
 */
export const POST = withAuthor(async ({ req, payload, tenantId }) => {
  const data = await readJson(req)
  if (data === undefined) return apiError('Некорректный запрос')

  const imageId = data.imageId
  if (!imageId) return apiError('Не указано изображение')

  // Видео принадлежит тенанту?
  const image: any = await payload
    .findByID({ collection: 'gallery-images', id: imageId, depth: 0, overrideAccess: true })
    .catch(() => null)
  if (!image) return apiError('Изображение не найдено', 404)
  const vTenant =
    image.tenant && typeof image.tenant === 'object' ? image.tenant.id : image.tenant
  if (Number(vTenant) !== Number(tenantId)) {
    return apiError('Изображение не найдено', 404)
  }

  // Целевая папка
  let folder: number | null = null
  if (data.folderId != null && data.folderId !== '') {
    const f: any = await payload
      .findByID({ collection: 'gallery-folders', id: data.folderId, depth: 0, overrideAccess: true })
      .catch(() => null)
    const fTenant = f && (typeof f.tenant === 'object' ? f.tenant.id : f.tenant)
    if (!f || Number(fTenant) !== Number(tenantId)) {
      return apiError('Папка не найдена')
    }
    folder = Number(data.folderId)
  }

  try {
    await payload.update({
      collection: 'gallery-images',
      id: imageId,
      data: { folder } as any,
      overrideAccess: true,
    })
    return apiOk({ folderId: folder })
  } catch (e: any) {
    return apiError(e?.message || 'Не удалось изменить папку изображения')
  }
})
