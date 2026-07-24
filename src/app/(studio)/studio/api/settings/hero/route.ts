import { withAuthor, readJson, apiError, apiOk, findTenantSettings } from '@/app/(studio)/studio/api/_lib'

/**
 * Сохранение секции «Hero» целиком: тексты (eyebrow, titleLines) + чипсы
 * (heroChips — массив id категорий). Объединённое сохранение — один POST
 * обновляет оба поля SiteSettings. SiteSettings — одна запись на тенант.
 *
 * Body: {
 *   eyebrow?: string,
 *   titleLines?: string,          // сырой textarea-текст со строками через \n
 *   chips?: [id, ...]             // id категорий-чипсов, порядок = порядок массива
 * }
 *
 * Пустые тексты допустимы (на чтении сработает мягкий фолбэк на дефолт).
 * Чужие чипсы (не принадлежащие тенанту) отфильтровываются. Дубликаты убираются.
 */

export const POST = withAuthor(async ({ req, payload, tenantId }) => {
  const data = await readJson(req)
  if (data === undefined) return apiError('Некорректный запрос')

  const eyebrow = typeof data.eyebrow === 'string' ? data.eyebrow : ''
  const titleLines = typeof data.titleLines === 'string' ? data.titleLines : ''

  // чипсы: отбрасываем пустые, дедуплицируем по String(id), сохраняя порядок
  const rawChips = Array.isArray(data.chips) ? data.chips : []
  const seen = new Set<string>()
  const requested: (number | string)[] = []
  for (const raw of rawChips) {
    if (raw === null || raw === undefined || raw === '') continue
    const key = String(raw)
    if (seen.has(key)) continue
    seen.add(key)
    requested.push(raw)
  }

  // фильтр принадлежности чипсов тенанту (как в home-categories POST)
  let allowedChips: (number | string)[] = requested
  if (requested.length > 0) {
    const catRes = await payload.find({
      collection: 'categories',
      where: { tenant: { equals: tenantId } },
      limit: 500,
      depth: 0,
      overrideAccess: true,
    })
    const ownIds = new Set((catRes.docs as any[]).map((c) => String(c.id)))
    allowedChips = requested.filter((id) => ownIds.has(String(id)))
  }

  const settings = await findTenantSettings(payload, tenantId)
  if (!settings) {
    return apiError('Настройки сайта не найдены', 404)
  }

  try {
    await payload.update({
      collection: 'site-settings',
      id: settings.id,
      data: {
        hero: { eyebrow, titleLines },
        heroChips: allowedChips,
      } as any,
      overrideAccess: true,
    })
    return apiOk()
  } catch (e: any) {
    return apiError(e?.message || 'Не удалось сохранить')
  }
})
