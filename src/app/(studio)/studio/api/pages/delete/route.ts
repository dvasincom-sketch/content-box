import { withAuthor, readJson, apiError, apiOk, belongsToTenant } from '@/app/(studio)/studio/api/_lib'

/**
 * Удаление страницы. Body: { id }.
 * Заодно удаляем пункты меню (kind='page'), ссылающиеся на эту страницу,
 * чтобы не осталось «висячих» пунктов.
 */
export const POST = withAuthor(async ({ req, payload, tenantId }) => {
  const data = await readJson(req)
  if (data === undefined) return apiError('Некорректный запрос')

  const id = data.id
  if (!id) return apiError('Не указана страница')

  const own = await belongsToTenant(payload, 'pages', id, tenantId)
  if (!own) return apiError('Страница не найдена', 404)

  try {
    await payload.delete({
      collection: 'menu-items',
      where: { and: [{ tenant: { equals: tenantId } }, { page: { equals: Number(id) } }] },
      overrideAccess: true,
    })
    await payload.delete({ collection: 'pages', id, overrideAccess: true })
    return apiOk()
  } catch (e: any) {
    return apiError(e?.message || 'Не удалось удалить страницу')
  }
})
