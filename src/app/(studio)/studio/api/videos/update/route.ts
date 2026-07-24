import { withAuthor, readJson, apiError, apiOk } from '@/app/(studio)/studio/api/_lib'

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
export const POST = withAuthor(async ({ req, payload, tenantId }) => {
  const data = await readJson(req)
  if (data === undefined) return apiError('Некорректный запрос')

  const videoId = data.videoId
  if (!videoId) return apiError('Не указано видео')

  const title = typeof data.title === 'string' ? data.title.trim() : ''
  if (!title) return apiError('Укажите название')

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
      return apiError('Уровень не найден')
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
    return apiOk({ title, minTierId: minTier })
  } catch (e: any) {
    return apiError(e?.message || 'Не удалось обновить видео')
  }
})
