import { withAuthor, readJson, apiError, apiOk, canMutateDoc } from '@/app/(studio)/studio/api/_lib'
import { errorMessage } from '@/lib/errorMessage'
import { parseVideoEmbed } from '@/lib/videoEmbed'

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
export const POST = withAuthor(async ({ req, payload, tenantId, author }) => {
  const data = await readJson(req)
  if (data === undefined) return apiError('Некорректный запрос')

  const videoId = data.videoId
  if (!(await canMutateDoc(payload, 'videos', videoId, author, 'videos', 'edit'))) return apiError('Недостаточно прав', 403)
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

  const numOrNull = (v: any): number | null => {
    if (v == null || v === '') return null
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  const patch: any = { title, minTier }
  if ('season' in data) patch.season = numOrNull(data.season)
  if ('episode' in data) patch.episode = numOrNull(data.episode)
  // Бесплатное превью: открыто всем, перебивает уровень (для вступительных глав).
  if ('isPreview' in data) patch.isPreview = Boolean(data.isPreview)

  // Категория (раздел / видео-плейлист). Проверяем принадлежность тенанту.
  if ('categoryId' in data) {
    if (data.categoryId == null || data.categoryId === '') {
      patch.category = null
    } else {
      const cat: any = await payload
        .findByID({ collection: 'categories', id: data.categoryId, depth: 0, overrideAccess: true })
        .catch(() => null)
      const cTenant = cat && (typeof cat.tenant === 'object' ? cat.tenant.id : cat.tenant)
      patch.category = cat && Number(cTenant) === Number(tenantId) ? Number(data.categoryId) : null
    }
  }

  // Свободные теги: если ключ передан — заменяем набор (пустой = очистить).
  // slug и дедуп посчитает хук normalizeTags коллекции.
  if ('tags' in data) {
    patch.tags = Array.isArray(data.tags)
      ? (data.tags as unknown[])
          .filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
          .map((t) => ({ label: t.trim() }))
      : []
  }

  // Внешняя вставка: смена исходной ссылки — переразбор и запись embed-полей.
  // Так чинится видео с ошибкой в ссылке. Поля embed под field-access
  // (только сервер), пишутся через overrideAccess у payload.update ниже.
  if (typeof data.embedUrl === 'string' && data.embedUrl.trim() !== '') {
    if (video.provider !== 'embed') {
      return apiError('Ссылку можно менять только у видео по внешней ссылке')
    }
    const parsed = parseVideoEmbed(data.embedUrl.trim())
    if (!parsed) {
      return apiError('Не удалось разобрать ссылку. Поддерживаются VK Видео, VK Клипы и Дзен.')
    }
    patch.embedProvider = parsed.provider
    patch.embedSrc = parsed.src
    patch.embedAspect = parsed.aspect
  }

  try {
    await payload.update({
      collection: 'videos',
      id: videoId,
      data: patch as any,
      overrideAccess: true,
    })
    return apiOk({ title, minTierId: minTier, season: patch.season, episode: patch.episode })
  } catch (e: unknown) {
    return apiError(errorMessage(e, 'Не удалось обновить видео'))
  }
})
