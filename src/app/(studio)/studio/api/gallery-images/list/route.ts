import { withAuthor, apiError, apiOk } from '@/app/(studio)/studio/api/_lib'

/**
 * Список изображений библиотеки тенанта — для модалки «выбрать из библиотеки»
 * в композере. Фильтр по папке + пагинация (библиотека может быть большой).
 *
 * Query:
 *   folder — id папки | 'none' (без папки) | пусто (все)
 *   page   — номер страницы (с 1)
 *   limit  — размер страницы (по умолч. 40, максимум 100)
 *
 * Возвращает { images: [{id, url, width, height, alt, folderId}], totalPages, page, total }.
 */
export const GET = withAuthor(async ({ req, payload, tenantId }) => {
  const { searchParams } = new URL(req.url)
  const folder = searchParams.get('folder') || ''
  const page = Math.max(1, Number(searchParams.get('page') || '1') || 1)
  const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') || '40') || 40))

  const and: any[] = [{ tenant: { equals: tenantId } }]
  if (folder === 'none') {
    and.push({ folder: { exists: false } })
  } else if (folder && folder !== 'all') {
    and.push({ folder: { equals: Number(folder) } })
  }

  try {
    const res = await payload.find({
      collection: 'gallery-images',
      where: { and },
      sort: '-createdAt',
      page,
      limit,
      depth: 0,
      overrideAccess: true,
    })

    const images = (res.docs as any[]).map((d) => ({
      id: d.id,
      url: d.url || null,
      width: d.width || null,
      height: d.height || null,
      alt: d.alt || '',
      folderId: d.folder ? (typeof d.folder === 'object' ? d.folder.id : d.folder) : null,
    }))

    return apiOk({
      images,
      page: res.page || page,
      totalPages: res.totalPages || 1,
      total: res.totalDocs || images.length,
    })
  } catch (e: any) {
    return apiError(e?.message || 'Не удалось загрузить библиотеку', 500)
  }
})
