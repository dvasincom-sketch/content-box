import { withAuthor, readJson, apiError, apiOk, belongsToTenant } from '@/app/(studio)/studio/api/_lib'

/**
 * Обновление папки видео: переименование и/или перемещение (смена родителя).
 *
 * Body: { id, title?, parentId? }
 *  - title  → переименовать (slug НЕ трогаем, он мог быть в связях/URL)
 *  - parentId: число → сделать дочерней указанной папки
 *               null  → поднять в корень
 *               отсутствует → родителя не менять
 *
 * Защита от циклов: нельзя переместить папку внутрь самой себя или своего потомка.
 */
export const POST = withAuthor(async ({ req, payload, tenantId }) => {
  const data = await readJson(req)
  if (data === undefined) return apiError('Некорректный запрос')

  const id = data.id
  if (!id) return apiError('Не указана папка')

  // Папка принадлежит тенанту?
  const existing: any = await payload
    .findByID({ collection: 'video-folders', id, depth: 0, overrideAccess: true })
    .catch(() => null)
  if (!existing) return apiError('Папка не найдена', 404)
  const fTenant =
    existing.tenant && typeof existing.tenant === 'object' ? existing.tenant.id : existing.tenant
  if (Number(fTenant) !== Number(tenantId)) {
    return apiError('Папка не найдена', 404)
  }

  const patch: any = {}

  if (typeof data.title === 'string') {
    const title = data.title.trim()
    if (!title) return apiError('Укажите название папки')
    patch.title = title
  }

  if ('parentId' in data) {
    if (data.parentId == null || data.parentId === '') {
      patch.parent = null // поднять в корень
    } else {
      const newParentId = Number(data.parentId)
      // нельзя быть родителем самому себе
      if (newParentId === Number(id)) {
        return apiError('Нельзя вложить папку саму в себя')
      }
      // новый родитель принадлежит тенанту?
      const okParent = await belongsToTenant(payload, 'video-folders', newParentId, tenantId)
      if (!okParent) {
        return apiError('Родительская папка не найдена')
      }
      // нельзя вложить в собственного потомка (цикл)
      const isDescendant = await isDescendantOf(payload, newParentId, Number(id), tenantId)
      if (isDescendant) {
        return apiError('Нельзя переместить папку внутрь её же подпапки')
      }
      patch.parent = newParentId
    }
  }

  if (Object.keys(patch).length === 0) {
    return apiOk() // нечего менять
  }

  try {
    await payload.update({
      collection: 'video-folders',
      id,
      data: patch,
      overrideAccess: true,
    })
    return apiOk()
  } catch (e: any) {
    return apiError(e?.message || 'Не удалось сохранить папку')
  }
})

/**
 * Проверяет, является ли `candidateId` потомком `ancestorId` (идём вверх по
 * parent от candidate; если встретили ancestor — да). Ограничение глубины 100.
 */
async function isDescendantOf(
  payload: any,
  candidateId: number,
  ancestorId: number,
  tenantId: number,
): Promise<boolean> {
  let currentId: number | null = candidateId
  let hops = 0
  while (currentId != null && hops < 100) {
    if (currentId === ancestorId) return true
    const doc: any = await payload
      .findByID({ collection: 'video-folders', id: currentId, depth: 0, overrideAccess: true })
      .catch(() => null)
    if (!doc) return false
    const t = doc.tenant && typeof doc.tenant === 'object' ? doc.tenant.id : doc.tenant
    if (Number(t) !== Number(tenantId)) return false
    const p = doc.parent && typeof doc.parent === 'object' ? doc.parent.id : doc.parent
    currentId = p != null ? Number(p) : null
    hops += 1
  }
  return false
}
