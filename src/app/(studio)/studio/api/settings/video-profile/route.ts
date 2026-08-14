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
  const renditions = String((settings as any)?.videoRenditions || '480,720')

  // Телеметрия последних кодирований — прозрачно показываем в панели профиля.
  let recent: unknown[] = []
  try {
    const res = await payload.find({
      collection: 'videos',
      where: { and: [{ tenant: { equals: tenantId } }, { provider: { equals: 'self' } }, { encodeMs: { exists: true } }] },
      sort: '-createdAt',
      limit: 12,
      depth: 0,
      overrideAccess: true,
    })
    recent = (res.docs as any[]).map((v) => ({
      title: v.title || 'Без названия',
      profile: v.videoProfile || null,
      durationSec: v.durationSec || null,
      originalBytes: v.originalBytes || null,
      assetBytes: v.assetBytes || null,
      encodeMs: v.encodeMs || null,
    }))
  } catch { /* телеметрия не критична */ }

  return apiOk({ profile: VALID.includes(profile) ? profile : 'balanced', renditions, recent })
})

const HEIGHTS = ['480', '720', '1080']

export const POST = withAuthor(async ({ req, payload, tenantId, author }) => {
  if (!authorCan(author, 'videos', 'create')) return apiError('Недостаточно прав', 403)
  const data = await readJson(req)
  if (data === undefined) return apiError('Некорректный запрос')
  const settings = await findTenantSettings(payload, tenantId)
  if (!settings) return apiError('Настройки сайта не найдены', 404)

  const patch: Record<string, unknown> = {}
  if (data.profile !== undefined) {
    const profile = String(data.profile || '')
    if (!VALID.includes(profile)) return apiError('Неизвестный профиль')
    patch.videoProfile = profile
  }
  if (data.renditions !== undefined) {
    const raw: string = Array.isArray(data.renditions) ? data.renditions.join(',') : String(data.renditions || '')
    const picked = new Set(raw.split(',').map((x: string) => x.trim()).filter((x: string) => HEIGHTS.includes(x)))
    if (!picked.size) return apiError('Выберите хотя бы одно разрешение')
    patch.videoRenditions = HEIGHTS.filter((h) => picked.has(h)).join(',') // каноничный порядок
  }
  if (!Object.keys(patch).length) return apiError('Нечего сохранять')

  try {
    await payload.update({ collection: 'site-settings', id: settings.id, data: patch as any, overrideAccess: true })
    return apiOk({ profile: patch.videoProfile, renditions: patch.videoRenditions })
  } catch (e: unknown) {
    return apiError(errorMessage(e, 'Не удалось сохранить'))
  }
})
