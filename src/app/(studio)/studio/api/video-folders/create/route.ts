import { NextResponse, type NextRequest } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getCurrentAuthor } from '@/lib/currentAuthor'
import { slugify } from '@/lib/slugify'

/**
 * Создание папки видео. Папки древовидные (nestedDocs), tenant-scoped.
 *
 * Body: { title, parentId? }
 *  - title обязателен
 *  - parentId — id родительской папки (для вложенности) или пусто (корень)
 *
 * slug генерится из title и делается уникальным в пределах (тенант + родитель),
 * т.к. beforeValidate в коллекции запрещает дубли на одном уровне.
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

  const title = String(data.title || '').trim()
  if (!title) return NextResponse.json({ error: 'Укажите название папки' }, { status: 400 })

  const payload = await getPayload({ config: await config })
  const tenantId = author.tenantId

  // Родитель (если задан) — проверяем принадлежность тенанту
  let parentId: number | null = null
  if (data.parentId != null && data.parentId !== '') {
    const ok = await belongsToTenant(payload, 'video-folders', data.parentId, tenantId)
    if (!ok) return NextResponse.json({ error: 'Родительская папка не найдена' }, { status: 400 })
    parentId = Number(data.parentId)
  }

  // Уникальный slug в пределах (тенант + родитель)
  const baseSlug = slugify(title) || 'folder'
  const slug = await ensureUniqueSlug(payload, tenantId, parentId, baseSlug)

  try {
    const doc = await payload.create({
      collection: 'video-folders',
      data: {
        title,
        slug,
        tenant: tenantId,
        ...(parentId ? { parent: parentId } : {}),
      } as any,
      overrideAccess: true,
    })
    return NextResponse.json({ ok: true, id: doc.id, title, slug })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Не удалось создать папку' },
      { status: 500 },
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

/** Уникальный slug в пределах тенанта и одного родителя: folder, folder-2... */
async function ensureUniqueSlug(
  payload: any,
  tenantId: number,
  parentId: number | null,
  base: string,
): Promise<string> {
  let candidate = base
  let n = 1
  while (n < 100) {
    const res = await payload.find({
      collection: 'video-folders',
      where: {
        and: [
          { tenant: { equals: tenantId } },
          { slug: { equals: candidate } },
          parentId ? { parent: { equals: parentId } } : { parent: { exists: false } },
        ],
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (res.totalDocs === 0) return candidate
    n += 1
    candidate = `${base}-${n}`
  }
  return `${base}-${Date.now()}`
}
