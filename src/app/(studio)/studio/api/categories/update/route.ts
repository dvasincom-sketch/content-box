import { NextResponse, type NextRequest } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getCurrentAuthor } from '@/lib/currentAuthor'
import { slugify } from '@/lib/slugify'

/**
 * Редактирование категории: title, slug, parent.
 *
 * Смена родителя безопасна благодаря nestedDocsPlugin (сам пересчитает
 * breadcrumbs/fullTitle потомков), НО плагин НЕ защищает от цикла (назначить
 * родителем собственного потомка). Проверяем это сами.
 *
 * Body: { id, title?, slug?, parentId? }  (parentId: null → в корень)
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

  // Категория принадлежит тенанту?
  const own = await belongsToTenant(payload, 'categories', id, tenantId)
  if (!own) return NextResponse.json({ error: 'Категория не найдена' }, { status: 404 })

  const patch: any = {}

  if (typeof data.title === 'string') {
    const t = data.title.trim()
    if (!t) return NextResponse.json({ error: 'Название не может быть пустым' }, { status: 400 })
    patch.title = t
  }

  if (typeof data.slug === 'string') {
    patch.slug = slugify(data.slug) || undefined
  }

  // Смена родителя
  if ('parentId' in data) {
    const newParent = data.parentId
    if (newParent == null) {
      patch.parent = null // в корень
    } else {
      if (String(newParent) === String(id)) {
        return NextResponse.json({ error: 'Категория не может быть родителем самой себя' }, { status: 400 })
      }
      const parentOk = await belongsToTenant(payload, 'categories', newParent, tenantId)
      if (!parentOk) return NextResponse.json({ error: 'Родитель не найден' }, { status: 400 })

      // Защита от цикла: новый родитель не должен быть потомком этой категории
      const wouldCycle = await isDescendant(payload, Number(newParent), Number(id), tenantId)
      if (wouldCycle) {
        return NextResponse.json(
          { error: 'Нельзя переместить категорию внутрь её собственной подкатегории' },
          { status: 400 },
        )
      }
      patch.parent = Number(newParent)
    }
  }

  try {
    await payload.update({
      collection: 'categories',
      id,
      data: patch,
      overrideAccess: true,
    })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Не удалось сохранить изменения' },
      { status: 400 },
    )
  }
}

/** Является ли candidate потомком ancestor (идём вверх по parent от candidate). */
async function isDescendant(
  payload: any,
  candidateId: number,
  ancestorId: number,
  tenantId: number,
): Promise<boolean> {
  let currentId: number | null = candidateId
  let guard = 0
  while (currentId != null && guard < 1000) {
    if (currentId === ancestorId) return true
    const doc: any = await payload.findByID({
      collection: 'categories',
      id: currentId,
      depth: 0,
      overrideAccess: true,
    }).catch(() => null)
    if (!doc) break
    const p = doc.parent && typeof doc.parent === 'object' ? doc.parent.id : doc.parent
    currentId = p != null ? Number(p) : null
    guard += 1
  }
  return false
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
