import { withAuthor, readJson, apiError, apiOk, belongsToTenant } from '@/app/(studio)/studio/api/_lib'
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
export const POST = withAuthor(async ({ req, payload, tenantId }) => {
  const data = await readJson(req)
  if (data === undefined) return apiError('Некорректный запрос')

  const title = String(data.title || '').trim()
  if (!title) return apiError('Укажите название папки')

  // Родитель (если задан) — проверяем принадлежность тенанту
  let parentId: number | null = null
  if (data.parentId != null && data.parentId !== '') {
    const ok = await belongsToTenant(payload, 'gallery-folders', data.parentId, tenantId)
    if (!ok) return apiError('Родительская папка не найдена')
    parentId = Number(data.parentId)
  }

  // Уникальный slug в пределах (тенант + родитель)
  const baseSlug = slugify(title) || 'folder'
  const slug = await ensureUniqueSlug(payload, tenantId, parentId, baseSlug)

  try {
    const doc = await payload.create({
      collection: 'gallery-folders',
      data: {
        title,
        slug,
        tenant: tenantId,
        ...(parentId ? { parent: parentId } : {}),
      } as any,
      overrideAccess: true,
    })
    return apiOk({ id: doc.id, title, slug })
  } catch (e: any) {
    return apiError(e?.message || 'Не удалось создать папку', 500)
  }
})

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
      collection: 'gallery-folders',
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
