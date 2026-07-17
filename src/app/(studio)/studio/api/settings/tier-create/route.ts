import { NextResponse, type NextRequest } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getCurrentAuthor } from '@/lib/currentAuthor'
import { slugify } from '@/lib/slugify'

/**
 * Создание уровня подписки. Все поля + плюшки.
 * Body: { name, slug?, weight, priceRub, description?, isActive?, perks? }
 */
const PERK_TYPES = ['included', 'star', 'warning', 'info']

export async function POST(req: NextRequest) {
  const author = await getCurrentAuthor()
  if (!author) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  let data: any
  try {
    data = await req.json()
  } catch {
    return NextResponse.json({ error: 'Некорректный запрос' }, { status: 400 })
  }

  const name = String(data.name || '').trim()
  if (!name) return NextResponse.json({ error: 'Укажите название' }, { status: 400 })

  const weight = Number(data.weight)
  if (Number.isNaN(weight) || weight < 0) {
    return NextResponse.json({ error: 'Вес должен быть числом ≥ 0' }, { status: 400 })
  }

  const priceRub = Number(data.priceRub)
  if (Number.isNaN(priceRub) || priceRub < 0) {
    return NextResponse.json({ error: 'Цена должна быть числом ≥ 0' }, { status: 400 })
  }

  const payload = await getPayload({ config: await config })

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
        tenant: author.tenantId,
      } as any,
      overrideAccess: true,
    })
    return NextResponse.json({ ok: true, id: doc.id })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Не удалось создать уровень' }, { status: 400 })
  }
}

function normalizePerks(raw: any[]): { type: string; text: string }[] {
  return raw
    .filter((p) => p && typeof p.text === 'string' && p.text.trim())
    .slice(0, 20)
    .map((p) => ({
      type: PERK_TYPES.includes(p.type) ? p.type : 'included',
      text: String(p.text).trim().slice(0, 200),
    }))
}
