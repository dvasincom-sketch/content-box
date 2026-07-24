import { withAuthor, readJson, apiError, apiOk } from '@/app/(studio)/studio/api/_lib'

/**
 * Удаление категории. БЕЗОПАСНЫЙ режим: удаляем только «пустую» категорию.
 * Запрет, если есть:
 *   - дочерние категории (parent = этой);
 *   - публикации с этой категорией.
 * Так исключаем осиротение дерева и повисшие ссылки у постов.
 *
 * Body: { id }
 */
export const POST = withAuthor(async ({ req, payload, tenantId }) => {
  const data = await readJson(req)
  if (data === undefined) return apiError('Некорректный запрос')

  const id = data.id
  if (!id) return apiError('Не указана категория')

  // Принадлежит тенанту?
  const doc: any = await payload
    .findByID({ collection: 'categories', id, depth: 0, overrideAccess: true })
    .catch(() => null)
  if (!doc) return apiError('Категория не найдена', 404)
  const docTenant = doc.tenant && typeof doc.tenant === 'object' ? doc.tenant.id : doc.tenant
  if (Number(docTenant) !== Number(tenantId)) {
    return apiError('Категория не найдена', 404)
  }

  // Есть дети?
  const children = await payload.find({
    collection: 'categories',
    where: { and: [{ tenant: { equals: tenantId } }, { parent: { equals: id } }] },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  if (children.totalDocs > 0) {
    return apiError('Сначала удалите или перенесите подкатегории', 409)
  }

  // Есть публикации?
  const pubs = await payload.find({
    collection: 'publications',
    where: { and: [{ tenant: { equals: tenantId } }, { category: { equals: id } }] },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  if (pubs.totalDocs > 0) {
    return apiError(`В категории есть публикации (${pubs.totalDocs}). Сначала переназначьте их.`, 409)
  }

  try {
    await payload.delete({ collection: 'categories', id, overrideAccess: true })
    return apiOk()
  } catch (e: any) {
    return apiError(e?.message || 'Не удалось удалить категорию')
  }
})
