import { withAuthor, apiError, apiOk, authorCan } from '@/app/(studio)/studio/api/_lib'
import { errorMessage } from '@/lib/errorMessage'
import { galleryUsageMap, type GalleryUsageMap } from '@/lib/galleryUsage'

/**
 * Список изображений библиотеки тенанта — для модалки «выбрать из библиотеки»
 * в композере. Фильтр по папке + пагинация (библиотека может быть большой).
 *
 * Query:
 *   folder — id папки | 'none' (без папки) | пусто (все)
 *   publication — id публикации-источника (приоритетнее folder)
 *   q      — поиск по подписи/имени файла (ILIKE)
 *   folder=orphan — только не используемые нигде изображения
 *   withUsage=1   — добавить usedCount (в скольких публикациях используется)
 *   page   — номер страницы (с 1)
 *   limit  — размер страницы (по умолч. 40, максимум 100)
 *
 * Возвращает { images: [{id, url, width, height, alt, folderId}], totalPages, page, total }.
 */
export const GET = withAuthor(async ({ req, payload, tenantId, author }) => {
  const { searchParams } = new URL(req.url)
  const folder = searchParams.get('folder') || ''
  const publication = searchParams.get('publication') || ''
  const q = (searchParams.get('q') || '').trim()
  const withUsage = searchParams.get('withUsage') === '1'
  const page = Math.max(1, Number(searchParams.get('page') || '1') || 1)
  const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') || '40') || 40))

  const and: any[] = [{ tenant: { equals: tenantId } }]
  if (!authorCan(author, 'gallery', 'viewAny') && !authorCan(author, 'gallery', 'editAny') && !authorCan(author, 'gallery', 'deleteAny')) and.push({ owner: { equals: author.user.id } })

  // Детектор использований нужен для скоупа orphan и для счётчика usedCount.
  let usage: GalleryUsageMap | null = null
  if (withUsage || folder === 'orphan') usage = await galleryUsageMap(payload, tenantId)
  if (folder === 'orphan') {
    // «Не используются»: изображения, которых нет ни в одной публикации.
    const usedIds = usage ? Array.from(usage.keys()) : []
    if (usedIds.length) and.push({ id: { not_in: usedIds } })
  } else if (publication && publication !== 'all') {
    // Скоуп «этой публикации» имеет приоритет над папкой.
    and.push({ sourcePublication: { equals: Number(publication) } })
  } else if (folder === 'none') {
    and.push({ folder: { exists: false } })
  } else if (folder && folder !== 'all') {
    and.push({ folder: { equals: Number(folder) } })
  }
  if (q) {
    // Находимость: поиск по подписи и имени файла (ILIKE).
    and.push({ or: [{ alt: { like: q } }, { filename: { like: q } }] })
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
      filesize: typeof d.filesize === 'number' ? d.filesize : null,
      folderId: d.folder ? (typeof d.folder === 'object' ? d.folder.id : d.folder) : null,
      sourcePublicationId: d.sourcePublication ? (typeof d.sourcePublication === 'object' ? d.sourcePublication.id : d.sourcePublication) : null,
      usedCount: usage ? (usage.get(Number(d.id))?.length ?? 0) : null,
    }))

    return apiOk({
      images,
      page: res.page || page,
      totalPages: res.totalPages || 1,
      total: res.totalDocs || images.length,
    })
  } catch (e: unknown) {
    return apiError(errorMessage(e, 'Не удалось загрузить библиотеку'), 500)
  }
})
