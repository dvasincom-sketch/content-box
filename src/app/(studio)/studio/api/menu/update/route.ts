import { withAuthor, readJson, apiError, apiOk, belongsToTenant } from '@/app/(studio)/studio/api/_lib'

/**
 * Обновление РУЧНОГО пункта меню (kind='page' | 'url').
 *
 * Переименование авто-категорий делает menu/upsert (labelOverride) — здесь
 * оверрайды категорий отклоняются. kind/parent/order здесь не меняются
 * (kind — пересоздать; parent/order — задача menu/reorder).
 *
 * Body: { id, labelOverride?, url?, pageId?, hidden? }
 */
export const POST = withAuthor(async ({ req, payload, tenantId }) => {
  const data = await readJson(req)
  if (data === undefined) return apiError('Некорректный запрос')

  const id = data.id
  if (!id) return apiError('Не указан пункт')

  // Пункт существует и принадлежит тенанту?
  const item = await payload
    .findByID({ collection: 'menu-items', id, depth: 0, overrideAccess: true })
    .catch(() => null)
  const t = item?.tenant && typeof item.tenant === 'object' ? item.tenant.id : item?.tenant
  if (!item || Number(t) !== Number(tenantId)) {
    return apiError('Пункт не найден', 404)
  }

  // Оверрайды авто-категорий здесь не редактируются.
  if (item.kind === 'category') {
    return apiError('Категории переименовываются через отдельную операцию')
  }

  const patch: any = {}

  if ('hidden' in data) patch.hidden = Boolean(data.hidden)

  if ('labelOverride' in data) {
    const l = typeof data.labelOverride === 'string' ? data.labelOverride.trim() : ''
    if (item.kind === 'url' && !l) {
      return apiError('Для внешней ссылки название обязательно')
    }
    patch.labelOverride = l || null // для page пусто → имя страницы
  }

  if (item.kind === 'url' && 'url' in data) {
    const u = typeof data.url === 'string' ? data.url.trim() : ''
    if (!u) return apiError('Не указан URL')
    patch.url = u
  }

  if (item.kind === 'page' && 'pageId' in data) {
    if (data.pageId == null) {
      return apiError('Не указана страница')
    }
    const pageOk = await belongsToTenant(payload, 'pages', data.pageId, tenantId)
    if (!pageOk) return apiError('Страница не найдена', 404)
    patch.page = Number(data.pageId)
  }

  if (Object.keys(patch).length === 0) {
    return apiError('Нет изменений')
  }

  try {
    await payload.update({
      collection: 'menu-items',
      id,
      data: patch,
      overrideAccess: true,
    })
    return apiOk()
  } catch (e: any) {
    return apiError(e?.message || 'Не удалось сохранить')
  }
})
