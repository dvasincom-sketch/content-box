import { withSubscriber, readJson, apiError, apiOk } from '../_lib'
import { normalizeHandle, handleError } from '@/lib/handle'

/**
 * Сохранение профиля участника: bio, handle, profilePrivate.
 * Валидация handle (формат/резерв/занятость в рамках тенанта). Скоуп — текущий подписчик.
 * Body: { bio?, handle?, profilePrivate? }
 */
export const POST = withSubscriber(async ({ payload, subscriber, tenantId, req }) => {
  const data = await readJson(req)
  if (data === undefined) return apiError('Некорректный запрос')

  const patch: Record<string, unknown> = {}

  // bio
  if (data.bio !== undefined) {
    const bio = String(data.bio || '').trim().slice(0, 280)
    if (/https?:\/\//i.test(bio)) return apiError('Ссылки в «о себе» не допускаются')
    patch.bio = bio
  }

  // profilePrivate
  if (data.profilePrivate !== undefined) {
    patch.profilePrivate = Boolean(data.profilePrivate)
  }

  // handle
  if (data.handle !== undefined) {
    const handle = normalizeHandle(String(data.handle || ''))
    if (handle === '') {
      return apiError('Укажите адрес профиля')
    }
    const err = handleError(handle)
    if (err) return apiError(err)
    // занятость в рамках тенанта (исключая себя)
    const dupe = await payload.find({
      collection: 'subscribers',
      where: {
        and: [
          { tenant: { equals: tenantId } },
          { handle: { equals: handle } },
          { id: { not_equals: subscriber.id } },
        ],
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (dupe.docs.length > 0) return apiError('Этот адрес уже занят')
    patch.handle = handle
  }

  if (Object.keys(patch).length === 0) return apiError('Нечего сохранять')

  try {
    await payload.update({
      collection: 'subscribers',
      id: subscriber.id,
      data: patch as any,
      overrideAccess: true,
    })
    return apiOk({ handle: patch.handle ?? subscriber.handle ?? null })
  } catch (e: any) {
    return apiError(e?.message || 'Не удалось сохранить')
  }
})
