import { withAuthor, readJson, apiError, apiOk, authorCan } from '@/app/(studio)/studio/api/_lib'
import { MIN_VIDEO_TIER_PRICE, tenantHasSelfVideo } from '@/lib/videoPricing'
import { logActivity } from '@/lib/logActivity'
import { errorMessage } from '@/lib/errorMessage'

/**
 * Редактирование уровня подписки: name, priceRub, isActive.
 * Только существующие уровни (создание/удаление — вне объёма).
 * Проверяем принадлежность тенанту.
 *
 * Body: { id, name?, priceRub?, isActive? }
 */
export const POST = withAuthor(async ({ req, payload, tenantId, author }) => {
  if (!authorCan(author, 'tiers', 'manage')) return apiError('Недостаточно прав', 403)
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
    if (price < MIN_VIDEO_TIER_PRICE && (await tenantHasSelfVideo(payload, tenantId))) {
      return apiError(`У вас есть загруженное видео — цена подписки не может быть ниже ${MIN_VIDEO_TIER_PRICE} ₽/мес.`)
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

  if (typeof data.badge === 'string') {
    patch.badge = data.badge.trim()
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
    await logActivity(payload, { tenant: tenantId, user: author.user.id, action: 'update', entity: 'тариф', title: 'Тариф подписки' })
    return apiOk()
  } catch (e: unknown) {
    return apiError(errorMessage(e, 'Не удалось сохранить'))
  }
})

const PERK_TYPES = ['included', 'star', 'warning', 'info']

/** Санитайзинг плюшек: валидный тип, непустой текст, максимум 20 штук.
 * Без export: route.ts не должен экспортировать посторонние члены (Next 16 type-check). */
function normalizePerks(raw: any[]): { type: string; text: string }[] {
  return raw
    .filter((p) => p && typeof p.text === 'string' && p.text.trim())
    .slice(0, 20)
    .map((p) => ({
      type: PERK_TYPES.includes(p.type) ? p.type : 'included',
      text: String(p.text).trim().slice(0, 200),
    }))
}
