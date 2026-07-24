import { withAuthor, readJson, apiError, apiOk } from '@/app/(studio)/studio/api/_lib'

/**
 * Удаление уровня подписки. Проверяем принадлежность тенанту.
 * Body: { id }
 *
 * Внимание: если на уровень ссылаются видео (minTier) или подписчики
 * (activeTier), Payload может вернуть ошибку связи — тогда сообщаем об этом.
 */
export const POST = withAuthor(async ({ req, payload, tenantId }) => {
  const data = await readJson(req)
  if (data === undefined) return apiError('Некорректный запрос')

  const id = data.id
  if (!id) return apiError('Не указан уровень')

  const doc: any = await payload
    .findByID({ collection: 'subscription-tiers', id, depth: 0, overrideAccess: true })
    .catch(() => null)
  if (!doc) return apiError('Уровень не найден', 404)
  const t = doc.tenant && typeof doc.tenant === 'object' ? doc.tenant.id : doc.tenant
  if (Number(t) !== Number(tenantId)) {
    return apiError('Уровень не найден', 404)
  }

  try {
    await payload.delete({ collection: 'subscription-tiers', id, overrideAccess: true })
    return apiOk()
  } catch (e: any) {
    return apiError('Не удалось удалить — возможно, на уровень ссылаются видео или подписчики')
  }
})
