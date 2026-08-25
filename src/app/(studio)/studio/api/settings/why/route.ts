import { withAuthor, readJson, apiError, apiOk, findTenantSettings, authorCan } from '@/app/(studio)/studio/api/_lib'
import { errorMessage } from '@/lib/errorMessage'
import { normalizeWhyUs, resolveWhyUs } from '@/lib/whyUs'
import { NextResponse } from 'next/server'

/**
 * Карточки блока «Почему мы» на главной (SiteSettings.whyUs, json).
 * Редактируется в конструкторе главной (секция «Почему мы»).
 *
 * GET  → { items: [{ icon, title, text }] }  (сохранённые или дефолт)
 * POST { items: [{ icon, title, text }] }
 */
export const GET = withAuthor(async ({ payload, tenantId }) => {
  const settings = await findTenantSettings(payload, tenantId)
  return NextResponse.json({ items: resolveWhyUs((settings as any)?.whyUs) })
})

export const POST = withAuthor(async ({ req, payload, tenantId, author }) => {
  if (!authorCan(author, 'appearance', 'manage')) return apiError('Недостаточно прав', 403)
  const data = await readJson(req)
  if (data === undefined) return apiError('Некорректный запрос')

  const items = normalizeWhyUs(data.items)

  const settings = await findTenantSettings(payload, tenantId)
  if (!settings) return apiError('Настройки сайта не найдены', 404)

  try {
    await payload.update({
      collection: 'site-settings',
      id: settings.id,
      // Пустой список → null: блок откатится на карточки по умолчанию.
      data: { whyUs: items.length > 0 ? items : null } as any,
      overrideAccess: true,
    })
    return apiOk()
  } catch (e: unknown) {
    return apiError(errorMessage(e, 'Не удалось сохранить'))
  }
})
