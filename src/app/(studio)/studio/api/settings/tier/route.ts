import { withAuthor, readJson, apiError, apiOk } from '@/app/(studio)/studio/api/_lib'

/**
 * Редактирование уровня подписки: name, priceRub, isActive.
 * Только существующие уровни (создание/удаление — вне объёма).
 * Проверяем принадлежность тенанту.
 *
 * Body: { id, name?, priceRub?, isActive? }
 */
export const POST = withAuthor(async ({ req, payload, tenantId }) => {
  const data = await readJson(req)
  if (data === undefined) return apiError('Некорректный запрос')

  const id = data.id
  if (!id) return apiError('Не указан уровень')

  // принадлежит тенанту?
  const doc: any = await payload
    .findByID({ collection: 'subscription-tiers', id, depth: 0, overrideAccess: true })
    .catch(() => null)
  if (!doc) return apiError('Уровень не найден', 404)
  const t = doc.tenant && typeof doc.tenant === 'object' ? doc.tenant.id : doc.tenant
  if (Number(t) !== Number(tenantId)) {
    return apiError('Уровень не найден', 404)
  }

  const patch: any = {}

  if (typeof data.name === 'string') {
    const name = data.name.trim()
    if (!name) return apiError('Название не может быть пустым')
    patch.name = name
  }

  if (data.priceRub !== undefined) {
    const price = Number(data.priceRub)
    if (Number.isNaN(price) || price < 0) {
      return apiError('Цена должна быть числом ≥ 0')
    }
    patch.priceRub = price
  }

  if (typeof data.isActive === 'boolean') {
    patch.isActive = data.isActive
  }

  if (data.weight !== undefined) {
    const w = Number(data.weight)
    if (Number.isNaN(w) || w < 0) {
      return apiError('Вес должен быть числом ≥ 0')
    }
    patch.weight = w
  }

  if (typeof data.slug === 'string') {
    const slug = data.slug.trim()
    if (slug) patch.slug = slug
  }

  if (typeof data.description === 'string') {
    patch.description = data.description
  }

  // Плюшки: массив { type, text }. Санитайзим типы и обрезаем пустые.
  if (Array.isArray(data.perks)) {
    patch.perks = normalizePerks(data.perks)
  }

  try {
    await payload.update({
      collection: 'subscription-tiers',
      id,
      data: patch,
      overrideAccess: true,
    })
    return apiOk()
  } catch (e: any) {
    return apiError(e?.message || 'Не удалось сохранить')
  }
})

const PERK_TYPES = ['included', 'star', 'warning', 'info']

/** Санитайзинг плюшек: валидный тип, непустой текст, максимум 20 штук. */
export function normalizePerks(raw: any[]): { type: string; text: string }[] {
  return raw
    .filter((p) => p && typeof p.text === 'string' && p.text.trim())
    .slice(0, 20)
    .map((p) => ({
      type: PERK_TYPES.includes(p.type) ? p.type : 'included',
      text: String(p.text).trim().slice(0, 200),
    }))
}
