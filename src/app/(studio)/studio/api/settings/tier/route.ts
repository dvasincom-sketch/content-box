import { NextResponse, type NextRequest } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getCurrentAuthor } from '@/lib/currentAuthor'

/**
 * Редактирование уровня подписки: name, priceRub, isActive.
 * Только существующие уровни (создание/удаление — вне объёма).
 * Проверяем принадлежность тенанту.
 *
 * Body: { id, name?, priceRub?, isActive? }
 */
export async function POST(req: NextRequest) {
  const author = await getCurrentAuthor()
  if (!author) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  let data: any
  try {
    data = await req.json()
  } catch {
    return NextResponse.json({ error: 'Некорректный запрос' }, { status: 400 })
  }

  const id = data.id
  if (!id) return NextResponse.json({ error: 'Не указан уровень' }, { status: 400 })

  const payload = await getPayload({ config: await config })
  const tenantId = author.tenantId

  // принадлежит тенанту?
  const doc: any = await payload
    .findByID({ collection: 'subscription-tiers', id, depth: 0, overrideAccess: true })
    .catch(() => null)
  if (!doc) return NextResponse.json({ error: 'Уровень не найден' }, { status: 404 })
  const t = doc.tenant && typeof doc.tenant === 'object' ? doc.tenant.id : doc.tenant
  if (Number(t) !== Number(tenantId)) {
    return NextResponse.json({ error: 'Уровень не найден' }, { status: 404 })
  }

  const patch: any = {}

  if (typeof data.name === 'string') {
    const name = data.name.trim()
    if (!name) return NextResponse.json({ error: 'Название не может быть пустым' }, { status: 400 })
    patch.name = name
  }

  if (data.priceRub !== undefined) {
    const price = Number(data.priceRub)
    if (Number.isNaN(price) || price < 0) {
      return NextResponse.json({ error: 'Цена должна быть числом ≥ 0' }, { status: 400 })
    }
    patch.priceRub = price
  }

  if (typeof data.isActive === 'boolean') {
    patch.isActive = data.isActive
  }

  if (data.weight !== undefined) {
    const w = Number(data.weight)
    if (Number.isNaN(w) || w < 0) {
      return NextResponse.json({ error: 'Вес должен быть числом ≥ 0' }, { status: 400 })
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
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Не удалось сохранить' },
      { status: 400 },
    )
  }
}

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
