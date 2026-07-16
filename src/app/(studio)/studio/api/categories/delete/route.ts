import { NextResponse, type NextRequest } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getCurrentAuthor } from '@/lib/currentAuthor'

/**
 * Удаление категории. БЕЗОПАСНЫЙ режим: удаляем только «пустую» категорию.
 * Запрет, если есть:
 *   - дочерние категории (parent = этой);
 *   - публикации с этой категорией.
 * Так исключаем осиротение дерева и повисшие ссылки у постов.
 *
 * Body: { id }
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
  if (!id) return NextResponse.json({ error: 'Не указана категория' }, { status: 400 })

  const payload = await getPayload({ config: await config })
  const tenantId = author.tenantId

  // Принадлежит тенанту?
  const doc: any = await payload
    .findByID({ collection: 'categories', id, depth: 0, overrideAccess: true })
    .catch(() => null)
  if (!doc) return NextResponse.json({ error: 'Категория не найдена' }, { status: 404 })
  const docTenant = doc.tenant && typeof doc.tenant === 'object' ? doc.tenant.id : doc.tenant
  if (Number(docTenant) !== Number(tenantId)) {
    return NextResponse.json({ error: 'Категория не найдена' }, { status: 404 })
  }

  // Есть дети?
  const children = await payload.find({
    collection: 'categories',
    where: { and: [{ tenant: { equals: tenantId } }, { parent: { equals: id } }] },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  if (children.totalDocs > 0) {
    return NextResponse.json(
      { error: 'Сначала удалите или перенесите подкатегории' },
      { status: 409 },
    )
  }

  // Есть публикации?
  const pubs = await payload.find({
    collection: 'publications',
    where: { and: [{ tenant: { equals: tenantId } }, { category: { equals: id } }] },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  if (pubs.totalDocs > 0) {
    return NextResponse.json(
      { error: `В категории есть публикации (${pubs.totalDocs}). Сначала переназначьте их.` },
      { status: 409 },
    )
  }

  try {
    await payload.delete({ collection: 'categories', id, overrideAccess: true })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Не удалось удалить категорию' },
      { status: 400 },
    )
  }
}
