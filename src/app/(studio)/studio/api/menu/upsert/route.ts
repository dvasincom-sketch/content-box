import { withAuthor, readJson, apiError, apiOk, belongsToTenant } from '@/app/(studio)/studio/api/_lib'

/**
 * Upsert оверрайда авто-категории (ленивая материализация).
 *
 * Первая правка авто-узла (скрытие / переименование / порядок) создаёт запись
 * menu-items с kind='category'. Повторные правки обновляют её. Оверрайд
 * уникален по паре (location, categoryId) — ищем существующий перед созданием.
 *
 * Body: { location, categoryId, hidden?, labelOverride?, order? }
 *   - labelOverride: '' или null → сбросить (вернуть имя категории)
 */
export const POST = withAuthor(async ({ req, payload, tenantId }) => {
  const data = await readJson(req)
  if (data === undefined) return apiError('Некорректный запрос')

  const location = data.location === 'footer' ? 'footer' : 'header'
  const categoryId = data.categoryId
  if (!categoryId) {
    return apiError('Не указана категория')
  }

  // Категория принадлежит тенанту?
  const own = await belongsToTenant(payload, 'categories', categoryId, tenantId)
  if (!own) return apiError('Категория не найдена', 404)

  // Собираем патч только из переданных полей.
  const patch: any = {}
  if ('hidden' in data) patch.hidden = Boolean(data.hidden)
  if ('order' in data && data.order != null) patch.order = Number(data.order)
  if ('labelOverride' in data) {
    const l = typeof data.labelOverride === 'string' ? data.labelOverride.trim() : ''
    patch.labelOverride = l || null // пусто → сброс к имени категории
  }

  try {
    // Существующий оверрайд для этой категории в этом location?
    const existing = await payload.find({
      collection: 'menu-items',
      where: {
        and: [
          { tenant: { equals: tenantId } },
          { location: { equals: location } },
          { kind: { equals: 'category' } },
          { category: { equals: Number(categoryId) } },
        ],
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const found = existing.docs[0] as any

    if (found) {
      const updated = await payload.update({
        collection: 'menu-items',
        id: found.id,
        data: patch,
        overrideAccess: true,
      })
      return apiOk({ id: (updated as any).id, created: false })
    }

    // Создаём новый оверрайд. tenant проставляем явно (наш access-паттерн).
    const created = await payload.create({
      collection: 'menu-items',
      data: {
        tenant: tenantId,
        location,
        kind: 'category',
        category: Number(categoryId),
        hidden: patch.hidden ?? false,
        order: patch.order ?? 0,
        labelOverride: patch.labelOverride ?? null,
      },
      overrideAccess: true,
    })
    return apiOk({ id: (created as any).id, created: true })
  } catch (e: any) {
    return apiError(e?.message || 'Не удалось сохранить')
  }
})
