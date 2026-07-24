import { withAuthor, readJson, apiError, apiOk, belongsToTenant } from '@/app/(studio)/studio/api/_lib'
import { slugify } from '@/lib/slugify'
import { htmlToLexical } from '@/lib/lexical'

/**
 * Редактирование категории: title, slug, parent, description, cover.
 *
 * Смена родителя безопасна благодаря nestedDocsPlugin (сам пересчитает
 * breadcrumbs/fullTitle потомков), НО плагин НЕ защищает от цикла (назначить
 * родителем собственного потомка). Проверяем это сами.
 *
 * Body: { id, title?, slug?, parentId? }  (parentId: null → в корень)
 */
export const POST = withAuthor(async ({ req, payload, tenantId }) => {
  const data = await readJson(req)
  if (data === undefined) return apiError('Некорректный запрос')

  const id = data.id
  if (!id) return apiError('Не указана категория')

  // Категория принадлежит тенанту?
  const own = await belongsToTenant(payload, 'categories', id, tenantId)
  if (!own) return apiError('Категория не найдена', 404)

  const patch: any = {}

  if (typeof data.title === 'string') {
    const t = data.title.trim()
    if (!t) return apiError('Название не может быть пустым')
    patch.title = t
  }

  if (typeof data.slug === 'string') {
    patch.slug = slugify(data.slug) || undefined
  }

  // Описание категории: HTML из редактора → Lexical (как у постов)
  if (typeof data.description === 'string') {
    patch.description = htmlToLexical(data.description)
  }

  // Обложка: число → установить (с проверкой тенанта), null → очистить
  if ('coverId' in data) {
    if (data.coverId == null) {
      patch.cover = null
    } else {
      const coverOk = await belongsToTenant(payload, 'media', data.coverId, tenantId)
      patch.cover = coverOk ? Number(data.coverId) : null
    }
  }

  // Режим обложки: киноблок (вертикальные постеры) вкл/выкл
  if ('posterLayout' in data) {
    patch.posterLayout = Boolean(data.posterLayout)
  }

  // Смена родителя
  if ('parentId' in data) {
    const newParent = data.parentId
    if (newParent == null) {
      patch.parent = null // в корень
    } else {
      if (String(newParent) === String(id)) {
        return apiError('Категория не может быть родителем самой себя')
      }
      const parentOk = await belongsToTenant(payload, 'categories', newParent, tenantId)
      if (!parentOk) return apiError('Родитель не найден')

      // Защита от цикла: новый родитель не должен быть потомком этой категории
      const wouldCycle = await isDescendant(payload, Number(newParent), Number(id), tenantId)
      if (wouldCycle) {
        return apiError('Нельзя переместить категорию внутрь её собственной подкатегории')
      }
      patch.parent = Number(newParent)
    }
  }

  try {
    await payload.update({
      collection: 'categories',
      id,
      data: patch,
      overrideAccess: true,
    })
    return apiOk()
  } catch (e: any) {
    return apiError(e?.message || 'Не удалось сохранить изменения')
  }
})

/** Является ли candidate потомком ancestor (идём вверх по parent от candidate). */
async function isDescendant(
  payload: any,
  candidateId: number,
  ancestorId: number,
  tenantId: number,
): Promise<boolean> {
  let currentId: number | null = candidateId
  let guard = 0
  while (currentId != null && guard < 1000) {
    if (currentId === ancestorId) return true
    const doc: any = await payload.findByID({
      collection: 'categories',
      id: currentId,
      depth: 0,
      overrideAccess: true,
    }).catch(() => null)
    if (!doc) break
    const p = doc.parent && typeof doc.parent === 'object' ? doc.parent.id : doc.parent
    currentId = p != null ? Number(p) : null
    guard += 1
  }
  return false
}
