import { withAuthor, readJson, apiError, apiOk, ownsForContributor } from '@/app/(studio)/studio/api/_lib'
import { errorMessage } from '@/lib/errorMessage'

/**
 * Обновить файл раздела «Файлы»: название, описание, уровень доступа,
 * категорию, флаг «бесплатно». Сам файл не меняем (перезалить — новой записью).
 *
 * Body: { id, title, description?, minTierId?, categoryId?, isPreview? }
 */
export const POST = withAuthor(async ({ req, payload, tenantId, author }) => {
  const data = await readJson(req)
  if (data === undefined) return apiError('Некорректный запрос')

  const id = data.id
  if (!(await ownsForContributor(payload, 'downloads' as any, id, author))) return apiError('Нет доступа к чужому контенту', 403)
  if (!id) return apiError('Не указан файл')

  const title = typeof data.title === 'string' ? data.title.trim() : ''
  if (!title) return apiError('Укажите название')

  // Файл принадлежит тенанту?
  const doc: any = await payload
    .findByID({ collection: 'downloads' as any, id, depth: 0, overrideAccess: true })
    .catch(() => null)
  if (!doc) return apiError('Файл не найден', 404)
  const dTenant = doc.tenant && typeof doc.tenant === 'object' ? doc.tenant.id : doc.tenant
  if (Number(dTenant) !== Number(tenantId)) return apiError('Файл не найден', 404)

  const patch: any = { title }
  patch.description = typeof data.description === 'string' ? data.description.trim() : null
  patch.isPreview = data.isPreview === true || data.isPreview === '1' || data.isPreview === 'true'

  // Уровень доступа
  if ('minTierId' in data) {
    if (data.minTierId == null || data.minTierId === '') {
      patch.minTier = null
    } else {
      const t: any = await payload
        .findByID({ collection: 'subscription-tiers', id: data.minTierId, depth: 0, overrideAccess: true })
        .catch(() => null)
      const tTenant = t && (typeof t.tenant === 'object' ? t.tenant.id : t.tenant)
      if (!t || Number(tTenant) !== Number(tenantId)) return apiError('Уровень не найден')
      patch.minTier = Number(data.minTierId)
    }
  }

  // Категория
  if ('categoryId' in data) {
    if (data.categoryId == null || data.categoryId === '') {
      patch.category = null
    } else {
      const cat: any = await payload
        .findByID({ collection: 'categories', id: data.categoryId, depth: 0, overrideAccess: true })
        .catch(() => null)
      const cTenant = cat && (typeof cat.tenant === 'object' ? cat.tenant.id : cat.tenant)
      patch.category = cat && Number(cTenant) === Number(tenantId) ? Number(data.categoryId) : null
    }
  }

  try {
    await payload.update({ collection: 'downloads' as any, id, data: patch as any, overrideAccess: true })
    return apiOk()
  } catch (e: unknown) {
    return apiError(errorMessage(e, 'Не удалось обновить файл'))
  }
})
