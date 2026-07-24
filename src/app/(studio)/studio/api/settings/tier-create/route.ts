import { withAuthor, readJson, apiError, apiOk } from '@/app/(studio)/studio/api/_lib'
import { slugify } from '@/lib/slugify'

/**
 * Создание уровня подписки. Все поля + плюшки.
 * Body: { name, slug?, weight, priceRub, description?, isActive?, perks? }
 */
const PERK_TYPES = ['included', 'star', 'warning', 'info']

export const POST = withAuthor(async ({ req, payload, tenantId }) => {
  const data = await readJson(req)
  if (data === undefined) return apiError('Некорректный запрос')

  const name = String(data.name || '').trim()
  if (!name) return apiError('Укажите название')

  const weight = Number(data.weight)
  if (Number.isNaN(weight) || weight < 0) {
    return apiError('Вес должен быть числом ≥ 0')
  }

  const priceRub = Number(data.priceRub)
  if (Number.isNaN(priceRub) || priceRub < 0) {
    return apiError('Цена должна быть числом ≥ 0')
  }

  try {
    const doc = await payload.create({
      collection: 'subscription-tiers',
      data: {
        name,
        slug: (typeof data.slug === 'string' && data.slug.trim()) || slugify(name) || `tier-${Date.now()}`,
        weight,
        priceRub,
        description: typeof data.description === 'string' ? data.description : undefined,
        isActive: data.isActive !== false,
        perks: Array.isArray(data.perks) ? normalizePerks(data.perks) : [],
        tenant: tenantId,
      } as any,
      overrideAccess: true,
    })
    return apiOk({ id: doc.id })
  } catch (e: any) {
    return apiError(e?.message || 'Не удалось создать уровень')
  }
})

function normalizePerks(raw: any[]): { type: string; text: string }[] {
  return raw
    .filter((p) => p && typeof p.text === 'string' && p.text.trim())
    .slice(0, 20)
    .map((p) => ({
      type: PERK_TYPES.includes(p.type) ? p.type : 'included',
      text: String(p.text).trim().slice(0, 200),
    }))
}
