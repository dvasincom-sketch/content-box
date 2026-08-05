import { NextResponse } from 'next/server'
import { withAuthor, readJson, apiError, apiOk, ownsForContributor } from '@/app/(studio)/studio/api/_lib'
import { errorMessage } from '@/lib/errorMessage'

/**
 * Удаление видео из студии.
 *
 * БЛОКИРУЕМ, если видео прикреплено к публикациям (relatedVideos): сначала
 * открепи его там — иначе в публикации останется битая привязка. Возвращаем
 * список таких публикаций (409), студия его показывает.
 *
 * Если не используется — удаляем запись и подчищаем пользовательские привязки
 * (закладки `bookmarks` и историю просмотров `views`), чтобы не оставлять
 * «висячие» ссылки на несуществующее видео.
 *
 * Body: { videoId }
 */
export const POST = withAuthor(async ({ req, payload, tenantId, author }) => {
  const data = await readJson(req)
  if (data === undefined) return apiError('Некорректный запрос')
  const videoId = data.videoId
  if (!(await ownsForContributor(payload, 'videos', videoId, author))) return apiError('Нет доступа к чужому контенту', 403)
  if (!videoId) return apiError('Не указано видео')

  // Видео принадлежит тенанту?
  const video: any = await payload
    .findByID({ collection: 'videos', id: videoId, depth: 0, overrideAccess: true })
    .catch(() => null)
  if (!video) return apiError('Видео не найдено', 404)
  const vTenant = video.tenant && typeof video.tenant === 'object' ? video.tenant.id : video.tenant
  if (Number(vTenant) !== Number(tenantId)) return apiError('Видео не найдено', 404)

  // Используется в публикациях? Блокируем и возвращаем список.
  const pubs = await payload.find({
    collection: 'publications',
    where: { and: [{ tenant: { equals: tenantId } }, { relatedVideos: { in: [videoId] } }] },
    depth: 0,
    limit: 50,
    overrideAccess: true,
  })
  if (pubs.totalDocs > 0) {
    const usedIn = (pubs.docs as any[]).map((p) => ({ id: p.id, title: p.title || 'Без заголовка' }))
    return NextResponse.json(
      {
        error: `Видео прикреплено к публикациям (${pubs.totalDocs}). Сначала открепите его там, затем удаляйте.`,
        usedIn,
      },
      { status: 409 },
    )
  }

  try {
    // Подчищаем пользовательские привязки к этому видео (не блокируют удаление).
    await payload
      .delete({ collection: 'bookmarks', where: { video: { equals: videoId } }, overrideAccess: true })
      .catch(() => {})
    await payload
      .delete({ collection: 'views', where: { video: { equals: videoId } }, overrideAccess: true })
      .catch(() => {})
    await payload.delete({ collection: 'videos', id: videoId, overrideAccess: true })
    return apiOk()
  } catch (e: unknown) {
    return apiError(errorMessage(e, 'Не удалось удалить видео'), 500)
  }
})
