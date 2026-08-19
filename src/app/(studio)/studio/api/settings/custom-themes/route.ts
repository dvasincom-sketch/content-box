import { withAuthor, readJson, apiError, apiOk, findTenantSettings, authorCan, belongsToTenant } from '@/app/(studio)/studio/api/_lib'
import { logActivity } from '@/lib/logActivity'
import { sanitizeCustomTheme } from '@/lib/themePresets'
import { errorMessage } from '@/lib/errorMessage'

/**
 * CRUD пользовательских тем (палитр) тенанта. Owner / право appearance.
 *  - POST   { name, theme }        — создать;
 *  - PATCH  { id, name?, theme? }  — изменить;
 *  - DELETE { id }                 — удалить (если активна — вернуть на пресет).
 * theme = { dark:{bg,surface,primary,accent,text,header?}, light:{...} } — hex.
 */
export const runtime = 'nodejs'

const MAX_THEMES = 20

export const POST = withAuthor(async ({ req, payload, tenantId, author }) => {
  if (!authorCan(author, 'appearance', 'manage')) return apiError('Недостаточно прав', 403)
  const data = await readJson(req)
  if (data === undefined) return apiError('Некорректный запрос')

  const name = String(data.name || '').trim().slice(0, 60)
  if (!name) return apiError('Введите название темы')
  const theme = sanitizeCustomTheme(data.theme)
  if (!theme) return apiError('Некорректная палитра: нужны все цвета в формате #RRGGBB')

  const existing = await payload.count({ collection: 'custom-themes' as any, where: { tenant: { equals: tenantId } }, overrideAccess: true })
  if ((existing.totalDocs || 0) >= MAX_THEMES) return apiError(`Достигнут предел своих тем (${MAX_THEMES})`)

  try {
    const created = (await payload.create({
      collection: 'custom-themes' as any,
      data: { tenant: tenantId, name, theme } as any,
      overrideAccess: true,
    })) as any
    await logActivity(payload, { tenant: tenantId, user: author.user.id, action: 'create', entity: 'оформление', title: `Своя тема: ${name}` })
    return apiOk({ id: created?.id })
  } catch (e: unknown) {
    return apiError(errorMessage(e, 'Не удалось создать тему'))
  }
})

export const PATCH = withAuthor(async ({ req, payload, tenantId, author }) => {
  if (!authorCan(author, 'appearance', 'manage')) return apiError('Недостаточно прав', 403)
  const data = await readJson(req)
  if (data === undefined) return apiError('Некорректный запрос')
  const id = Number(data.id)
  if (!Number.isFinite(id) || id <= 0) return apiError('Некорректный id')
  if (!(await belongsToTenant(payload, 'custom-themes' as any, id, tenantId))) return apiError('Тема не найдена', 404)

  const patch: Record<string, unknown> = {}
  if (typeof data.name === 'string') {
    const name = data.name.trim().slice(0, 60)
    if (!name) return apiError('Введите название темы')
    patch.name = name
  }
  if (data.theme !== undefined) {
    const theme = sanitizeCustomTheme(data.theme)
    if (!theme) return apiError('Некорректная палитра: нужны все цвета в формате #RRGGBB')
    patch.theme = theme
  }
  if (Object.keys(patch).length === 0) return apiError('Нечего сохранять')

  try {
    await payload.update({ collection: 'custom-themes' as any, id, data: patch as any, overrideAccess: true })
    return apiOk()
  } catch (e: unknown) {
    return apiError(errorMessage(e, 'Не удалось сохранить'))
  }
})

export const DELETE = withAuthor(async ({ req, payload, tenantId, author }) => {
  if (!authorCan(author, 'appearance', 'manage')) return apiError('Недостаточно прав', 403)
  const data = await readJson(req)
  if (data === undefined) return apiError('Некорректный запрос')
  const id = Number(data.id)
  if (!Number.isFinite(id) || id <= 0) return apiError('Некорректный id')
  if (!(await belongsToTenant(payload, 'custom-themes' as any, id, tenantId))) return apiError('Тема не найдена', 404)

  try {
    await payload.delete({ collection: 'custom-themes' as any, id, overrideAccess: true })
    // Удалили активную тему — возвращаем тенант на палитру пресета.
    const settings = await findTenantSettings(payload, tenantId)
    if (settings && (settings as any).themeSource === 'custom' && Number((settings as any).activeCustomTheme) === id) {
      await payload.update({
        collection: 'site-settings',
        id: settings.id,
        data: { themeSource: 'preset', activeCustomTheme: null } as any,
        overrideAccess: true,
      })
    }
    return apiOk()
  } catch (e: unknown) {
    return apiError(errorMessage(e, 'Не удалось удалить'))
  }
})
