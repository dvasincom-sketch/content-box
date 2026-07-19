import { NextResponse, type NextRequest } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getCurrentAuthor } from '@/lib/currentAuthor'

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
export async function POST(req: NextRequest) {
  const author = await getCurrentAuthor()
  if (!author) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  let data: any
  try {
    data = await req.json()
  } catch {
    return NextResponse.json({ error: 'Некорректный запрос' }, { status: 400 })
  }

  const location = data.location === 'footer' ? 'footer' : 'header'
  const categoryId = data.categoryId
  if (!categoryId) {
    return NextResponse.json({ error: 'Не указана категория' }, { status: 400 })
  }

  const payload = await getPayload({ config: await config })
  const tenantId = author.tenantId

  // Категория принадлежит тенанту?
  const own = await belongsToTenant(payload, 'categories', categoryId, tenantId)
  if (!own) return NextResponse.json({ error: 'Категория не найдена' }, { status: 404 })

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
      return NextResponse.json({ ok: true, id: (updated as any).id, created: false })
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
    return NextResponse.json({ ok: true, id: (created as any).id, created: true })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Не удалось сохранить' },
      { status: 400 },
    )
  }
}

async function belongsToTenant(
  payload: any,
  collection: string,
  id: string | number,
  tenantId: number,
): Promise<boolean> {
  try {
    const doc = await payload.findByID({ collection, id, depth: 0, overrideAccess: true })
    const t = doc?.tenant && typeof doc.tenant === 'object' ? doc.tenant.id : doc?.tenant
    return Number(t) === Number(tenantId)
  } catch {
    return false
  }
}
