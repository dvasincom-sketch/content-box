import { withAuthor, readJson, apiError, apiOk, findTenantSettings, authorCan } from '@/app/(studio)/studio/api/_lib'
import { errorMessage } from '@/lib/errorMessage'

/**
 * Профиль сжатия видео проекта (дефолт для НОВЫХ загрузок). Хранится в
 * site-settings.videoProfile. Значения: fast | balanced | compact | quality.
 * GET → { profile }. POST { profile } → сохранить.
 */
const VALID = ['fast', 'balanced', 'compact', 'quality']

export const GET = withAuthor(async ({ payload, tenantId }) => {
  const settings = await findTenantSettings(payload, tenantId)
  const profile = String((settings as any)?.videoProfile || 'balanced')
  return apiOk({ profile: VALID.includes(profile) ? profile : 'balanced' })
})

export const POST = withAuthor(async ({ req, payload, tenantId, author }) => {
  if (!authorCan(author, 'videos', 'create')) return apiError('Недостаточно прав', 403)
  const data = await readJson(req)
  if (data === undefined) return apiError('Некорректный запрос')
  const profile = String(data.profile || '')
  if (!VALID.includes(profile)) return apiError('Неизвестный профиль')
  const settings = await findTenantSettings(payload, tenantId)
  if (!settings) return apiError('Настройки сайта не найдены', 404)
  try {
    await payload.update({ collection: 'site-settings', id: settings.id, data: { videoProfile: profile } as any, overrideAccess: true })
    return apiOk({ profile })
  } catch (e: unknown) {
    return apiError(errorMessage(e, 'Не удалось сохранить профиль'))
  }
})
