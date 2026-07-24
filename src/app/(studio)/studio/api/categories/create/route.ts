import { withAuthor, readJson, apiError, apiOk, belongsToTenant } from '@/app/(studio)/studio/api/_lib'
import { slugify } from '@/lib/slugify'

/**
 * Создание категории. Серверный роут + Local API, тенант из сессии автора.
 *
 * Поля студийной формы: title, slug (авто из title, если пусто), parentId (опц).
 * Остальное (order, showInHeader, SEO, breadcrumbs, fullTitle) — дефолты/авто
 * через хуки коллекции и nestedDocsPlugin.
 *
 * slug уникален В ПРЕДЕЛАХ РОДИТЕЛЯ — проверку делает beforeValidate коллекции;
 * ловим её ошибку и возвращаем читаемо.
 */
export const POST = withAuthor(async ({ req, payload, tenantId }) => {
  const data = await readJson(req)
  if (data === undefined) return apiError('Некорректный запрос')

  const title = (data.title || '').trim()
  if (!title) return apiError('Укажите название')

  // Родитель (опционально) — проверяем принадлежность тенанту
  let parentId: number | undefined
  if (data.parentId) {
    const ok = await belongsToTenant(payload, 'categories', data.parentId, tenantId)
    if (!ok) return apiError('Родитель не найден')
    parentId = Number(data.parentId)
  }

  const slug = slugify(data.slug || title) || 'category'

  try {
    const doc = await payload.create({
      collection: 'categories',
      data: {
        title,
        slug,
        tenant: tenantId,
        ...(parentId ? { parent: parentId } : {}),
      } as any,
      overrideAccess: true,
    })
    return apiOk({ id: doc.id })
  } catch (e: any) {
    // Коллизия slug в пределах родителя (из beforeValidate) — читаемое сообщение
    return apiError(e?.message || 'Не удалось создать категорию')
  }
})
