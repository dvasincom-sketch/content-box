import { NextResponse, type NextRequest } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getCurrentAuthor } from '@/lib/currentAuthor'
import { slugify } from '@/lib/slugify'

/**
 * Создание категории. Серверный роут + Local API, тенант из сессии автора.
 *
 * Поля студийной формы: title, slug (авто из title, если пусто), parentId (опц).
 * Остальное (order, showInHeader, SEO, breadcrumbs, fullTitle) — дефолты/авто
 * через хуки коллекции и nestedDocsPlugin.
 *
 * slug уникален В ПРЕДЕЛАХ РОДИТЕЛЯ — проверку делает beforeValidate коллекции;
 * ловим её ошибку и возвращаем читаемо.
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

  const title = (data.title || '').trim()
  if (!title) return NextResponse.json({ error: 'Укажите название' }, { status: 400 })

  const payload = await getPayload({ config: await config })
  const tenantId = author.tenantId

  // Родитель (опционально) — проверяем принадлежность тенанту
  let parentId: number | undefined
  if (data.parentId) {
    const ok = await belongsToTenant(payload, 'categories', data.parentId, tenantId)
    if (!ok) return NextResponse.json({ error: 'Родитель не найден' }, { status: 400 })
    parentId = Number(data.parentId)
  }

  const slug = slugify(data.slug || title) || 'category'

  try {
    const doc = await payload.create({
      collection: 'categories',
      data: {
        title,
        slug,
        tenant: tenantId,
        ...(parentId ? { parent: parentId } : {}),
      } as any,
      overrideAccess: true,
    })
    return NextResponse.json({ ok: true, id: doc.id })
  } catch (e: any) {
    // Коллизия slug в пределах родителя (из beforeValidate) — читаемое сообщение
    return NextResponse.json(
      { error: e?.message || 'Не удалось создать категорию' },
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
