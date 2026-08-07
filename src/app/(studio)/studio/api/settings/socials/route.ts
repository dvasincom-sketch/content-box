import { withAuthor, readJson, apiError, apiOk, findTenantSettings, authorCan } from '@/app/(studio)/studio/api/_lib'
import { errorMessage } from '@/lib/errorMessage'

/**
 * Сохранение соцсетей. SiteSettings — одна запись на тенант (isGlobal через
 * multi-tenant плагин). Находим её по tenant, обновляем массив socials.
 *
 * Body: { socials: [{ platform, url }] }
 * platform ∈ boosty|vk|telegram|youtube|instagram (валидируем).
 */

const PLATFORMS = ['boosty', 'vk', 'telegram', 'youtube', 'instagram']

export const POST = withAuthor(async ({ req, payload, tenantId, author }) => {
  if (!authorCan(author, 'appearance', 'manage')) return apiError('Недостаточно прав', 403)
  const data = await readJson(req)
  if (data === undefined) return apiError('Некорректный запрос')

  const rawSocials = Array.isArray(data.socials) ? data.socials : []
  // валидация и очистка
  const socials: { platform: string; url: string }[] = []
  for (const s of rawSocials) {
    const platform = String(s?.platform || '').trim()
    const url = String(s?.url || '').trim()
    if (!PLATFORMS.includes(platform)) {
      return apiError(`Неизвестная площадка: ${platform}`)
    }
    if (!url) {
      return apiError('У каждой соцсети должна быть ссылка')
    }
    socials.push({ platform, url })
  }

  const settings = await findTenantSettings(payload, tenantId)
  if (!settings) {
    return apiError('Настройки сайта не найдены', 404)
  }

  try {
    await payload.update({
      collection: 'site-settings',
      id: settings.id,
      data: { socials } as any,
      overrideAccess: true,
    })
    return apiOk()
  } catch (e: unknown) {
    return apiError(errorMessage(e, 'Не удалось сохранить'))
  }
})
