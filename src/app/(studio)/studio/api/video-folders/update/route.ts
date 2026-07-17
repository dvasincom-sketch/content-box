import { NextResponse, type NextRequest } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getCurrentAuthor } from '@/lib/currentAuthor'

/**
 * Обновление папки видео: переименование и/или перемещение (смена родителя).
 *
 * Body: { id, title?, parentId? }
 *  - title  → переименовать (slug НЕ трогаем, он мог быть в связях/URL)
 *  - parentId: число → сделать дочерней указанной папки
 *               null  → поднять в корень
 *               отсутствует → родителя не менять
 *
 * Защита от циклов: нельзя переместить папку внутрь самой себя или своего потомка.
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
  if (!id) return NextResponse.json({ error: 'Не указана папка' }, { status: 400 })

  const payload = await getPayload({ config: await config })
  const tenantId = author.tenantId

  // Папка принадлежит тенанту?
  const existing: any = await payload
    .findByID({ collection: 'video-folders', id, depth: 0, overrideAccess: true })
    .catch(() => null)
  if (!existing) return NextResponse.json({ error: 'Папка не найдена' }, { status: 404 })
  const fTenant =
    existing.tenant && typeof existing.tenant === 'object' ? existing.tenant.id : existing.tenant
  if (Number(fTenant) !== Number(tenantId)) {
    return NextResponse.json({ error: 'Папка не найдена' }, { status: 404 })
  }

  const patch: any = {}

  if (typeof data.title === 'string') {
    const title = data.title.trim()
    if (!title) return NextResponse.json({ error: 'Укажите название папки' }, { status: 400 })
    patch.title = title
  }

  if ('parentId' in data) {
    if (data.parentId == null || data.parentId === '') {
      patch.parent = null // поднять в корень
    } else {
      const newParentId = Number(data.parentId)
      // нельзя быть родителем самому себе
      if (newParentId === Number(id)) {
        return NextResponse.json(
          { error: 'Нельзя вложить папку саму в себя' },
          { status: 400 },
        )
      }
      // новый родитель принадлежит тенанту?
      const okParent = await belongsToTenant(payload, 'video-folders', newParentId, tenantId)
      if (!okParent) {
        return NextResponse.json({ error: 'Родительская папка не найдена' }, { status: 400 })
      }
      // нельзя вложить в собственного потомка (цикл)
      const isDescendant = await isDescendantOf(payload, newParentId, Number(id), tenantId)
      if (isDescendant) {
        return NextResponse.json(
          { error: 'Нельзя переместить папку внутрь её же подпапки' },
          { status: 400 },
        )
      }
      patch.parent = newParentId
    }
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: true }) // нечего менять
  }

  try {
    await payload.update({
      collection: 'video-folders',
      id,
      data: patch,
      overrideAccess: true,
    })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Не удалось сохранить папку' },
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

/**
 * Проверяет, является ли `candidateId` потомком `ancestorId` (идём вверх по
 * parent от candidate; если встретили ancestor — да). Ограничение глубины 100.
 */
async function isDescendantOf(
  payload: any,
  candidateId: number,
  ancestorId: number,
  tenantId: number,
): Promise<boolean> {
  let currentId: number | null = candidateId
  let hops = 0
  while (currentId != null && hops < 100) {
    if (currentId === ancestorId) return true
    const doc: any = await payload
      .findByID({ collection: 'video-folders', id: currentId, depth: 0, overrideAccess: true })
      .catch(() => null)
    if (!doc) return false
    const t = doc.tenant && typeof doc.tenant === 'object' ? doc.tenant.id : doc.tenant
    if (Number(t) !== Number(tenantId)) return false
    const p = doc.parent && typeof doc.parent === 'object' ? doc.parent.id : doc.parent
    currentId = p != null ? Number(p) : null
    hops += 1
  }
  return false
}
