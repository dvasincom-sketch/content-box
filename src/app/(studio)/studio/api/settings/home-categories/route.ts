import { withAuthor, readJson, apiError, apiOk, findTenantSettings } from '@/app/(studio)/studio/api/_lib'

/**
 * Сохранение категорий-плиток (homeCategories) секции «Категории» главной.
 * SiteSettings — одна запись на тенант. Порядок = порядок массива.
 *
 * Body: { categories: [id, ...] }  (id категорий — число|строка)
 *
 * Пустой массив допустим (блок «Категории» не показывается). Дубликаты
 * убираются. Чужие категории (не принадлежащие тенанту) отфильтровываются —
 * сверяем присланные id со списком категорий тенанта.
 */

export const POST = withAuthor(async ({ req, payload, tenantId }) => {
  const data = await readJson(req)
  if (data === undefined) return apiError('Некорректный запрос')

  const rawIds = Array.isArray(data.categories) ? data.categories : []

  // нормализуем: отбрасываем пустые, дедуплицируем (по строковому виду id),
  // сохраняя порядок первого вхождения
  const seen = new Set<string>()
  const requested: (number | string)[] = []
  for (const raw of rawIds) {
    if (raw === null || raw === undefined || raw === '') continue
    const key = String(raw)
    if (seen.has(key)) continue
    seen.add(key)
    requested.push(raw)
  }

  // Проверка принадлежности тенанту: берём все категории тенанта, оставляем
  // только присланные id, которые реально принадлежат ему. Порядок — как прислан.
  let allowed: (number | string)[] = requested
  if (requested.length > 0) {
    const catRes = await payload.find({
      collection: 'categories',
      where: { tenant: { equals: tenantId } },
      limit: 500,
      depth: 0,
      overrideAccess: true,
    })
    const ownIds = new Set((catRes.docs as any[]).map((c) => String(c.id)))
    allowed = requested.filter((id) => ownIds.has(String(id)))
  }

  const settings = await findTenantSettings(payload, tenantId)
  if (!settings) {
    return apiError('Настройки сайта не найдены', 404)
  }

  try {
    await payload.update({
      collection: 'site-settings',
      id: settings.id,
      data: { homeCategories: allowed } as any,
      overrideAccess: true,
    })
    return apiOk()
  } catch (e: any) {
    return apiError(e?.message || 'Не удалось сохранить')
  }
})
