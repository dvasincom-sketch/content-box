import { withAuthor, readJson, apiError, apiOk } from '@/app/(studio)/studio/api/_lib'
import { errorMessage } from '@/lib/errorMessage'

/**
 * Удаление файла из раздела «Файлы». Проверяем принадлежность тенанту и
 * удаляем запись (сам объект в S3 подчищает адаптер хранилища).
 *
 * Body: { id }
 */
export const POST = withAuthor(async ({ req, payload, tenantId }) => {
  const data = await readJson(req)
  if (data === undefined) return apiError('Некорректный запрос')
  const id = data.id
  if (!id) return apiError('Не указан файл')

  const doc: any = await payload
    .findByID({ collection: 'downloads' as any, id, depth: 0, overrideAccess: true })
    .catch(() => null)
  if (!doc) return apiError('Файл не найден', 404)
  const dTenant = doc.tenant && typeof doc.tenant === 'object' ? doc.tenant.id : doc.tenant
  if (Number(dTenant) !== Number(tenantId)) return apiError('Файл не найден', 404)

  try {
    await payload.delete({ collection: 'downloads' as any, id, overrideAccess: true })
    return apiOk()
  } catch (e: unknown) {
    return apiError(errorMessage(e, 'Не удалось удалить файл'), 500)
  }
})
