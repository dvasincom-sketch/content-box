import { withAuthor, readJson, apiError, apiOk, findTenantSettings, authorCan } from '@/app/(studio)/studio/api/_lib'
import { errorMessage } from '@/lib/errorMessage'
import { NextResponse } from 'next/server'

/**
 * Соцсети главной. SiteSettings — одна запись на тенант (isGlobal через
 * multi-tenant плагин). Находим её по tenant, читаем/обновляем массив socials.
 * Редактируется в конструкторе главной (секция «Соцсети»).
 *
 * GET  → { socials: [{ platform, url, description }] }
 * POST { socials: [{ platform, url, description? }] }
 * platform ∈ boosty|vk|telegram|youtube|instagram (валидируем).
 */

const PLATFORMS = ['boosty', 'vk', 'telegram', 'youtube', 'instagram']

export const GET = withAuthor(async ({ payload, tenantId }) => {
  const settings = await findTenantSettings(payload, tenantId)
  const raw = Array.isArray((settings as any)?.socials) ? (settings as any).socials : []
  const socials = raw.map((s: any) => ({
    platform: String(s?.platform || ''),
    url: String(s?.url || ''),
    description: typeof s?.description === 'string' ? s.description : '',
  }))
  return NextResponse.json({ socials })
})

export const POST = withAuthor(async ({ req, payload, tenantId, author }) => {
  if (!authorCan(author, 'appearance', 'manage')) return apiError('Недостаточно прав', 403)
  const data = await readJson(req)
  if (data === undefined) return apiError('Некорректный запрос')

  const rawSocials = Array.isArray(data.socials) ? data.socials : []
  // валидация и очистка
  const socials: { platform: string; url: string; description: string }[] = []
  for (const s of rawSocials) {
    const platform = String(s?.platform || '').trim()
    const url = String(s?.url || '').trim()
    if (!PLATFORMS.includes(platform)) {
      return apiError(`Неизвестная площадка: ${platform}`)
    }
    if (!url) {
      return apiError('У каждой соцсети должна быть ссылка')
    }
    const description = String(s?.description || '').trim().slice(0, 200)
    socials.push({ platform, url, description })
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
