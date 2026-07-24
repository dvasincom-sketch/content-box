import { withAuthor, apiError, apiOk } from '@/app/(studio)/studio/api/_lib'

/**
 * Чтение выбранных категорий-плиток (homeCategories) для редактора секции
 * «Категории» в студии. SiteSettings — одна запись на тенант. Возвращаем
 * выбранные категории В ТЕКУЩЕМ ПОРЯДКЕ (порядок = порядок массива relationship)
 * с id/title/coverUrl для превью в верхнем dnd-списке панели.
 *
 * depth: 1 — чтобы элементы homeCategories пришли объектами (id/title/cover).
 * Полный список всех категорий (для дерева+поиска) панель берёт отдельно из
 * /studio/api/settings/categories-list.
 *
 * Ответ: { ok, selected: [{ id, title, coverUrl }] } | { error }
 */

export const GET = withAuthor(async ({ payload, tenantId }) => {
  const res = await payload.find({
    collection: 'site-settings',
    where: { tenant: { equals: tenantId } },
    limit: 1,
    depth: 1,
    overrideAccess: true,
  })
  const settings = res.docs[0] as any
  if (!settings) {
    return apiError('Настройки сайта не найдены', 404)
  }

  const raw = Array.isArray(settings.homeCategories) ? settings.homeCategories : []
  const selected = raw
    // отсеиваем «висячие» связи (id без объекта / удалённые категории)
    .filter((c: any) => c && typeof c === 'object')
    .map((c: any) => {
      const cover = c.cover
      const coverUrl = cover && typeof cover === 'object' ? (cover.url ?? null) : null
      return { id: c.id, title: c.title ?? '', coverUrl }
    })

  return apiOk({ selected })
})
