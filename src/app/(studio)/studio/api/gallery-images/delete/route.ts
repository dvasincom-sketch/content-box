import { NextResponse } from 'next/server'
import { withAuthor, readJson, apiError, apiOk, ownsForContributor } from '@/app/(studio)/studio/api/_lib'
import { errorMessage } from '@/lib/errorMessage'

/**
 * Удаление изображения библиотеки галереи.
 *
 * БЛОКИРУЕМ, если изображение прикреплено к галереям публикаций
 * (publications.gallery[].image): сначала открепи его там — иначе в публикации
 * останется битая ячейка. Возвращаем список таких публикаций (409).
 *
 * Body: { id }
 */
export const POST = withAuthor(async ({ req, payload, tenantId, author }) => {
  const data = await readJson(req)
  if (data === undefined) return apiError('Некорректный запрос')
  const id = data.id
  if (!(await ownsForContributor(payload, 'gallery-images', id, author))) return apiError('Нет доступа к чужому контенту', 403)
  if (!id) return apiError('Не указано изображение')

  const img: any = await payload
    .findByID({ collection: 'gallery-images', id, depth: 0, overrideAccess: true })
    .catch(() => null)
  if (!img) return apiError('Изображение не найдено', 404)
  const iTenant = img.tenant && typeof img.tenant === 'object' ? img.tenant.id : img.tenant
  if (Number(iTenant) !== Number(tenantId)) return apiError('Изображение не найдено', 404)

  // Используется в галереях публикаций? Блокируем.
  const pubs = await payload.find({
    collection: 'publications',
    where: { and: [{ tenant: { equals: tenantId } }, { 'gallery.image': { equals: id } }] },
    depth: 0, limit: 50, overrideAccess: true,
  })
  if (pubs.totalDocs > 0) {
    const usedIn = (pubs.docs as any[]).map((p) => ({ id: p.id, title: p.title || 'Без заголовка' }))
    return NextResponse.json(
      {
        error: `Изображение используется в публикациях (${pubs.totalDocs}). Сначала открепите его там.`,
        usedIn,
      },
      { status: 409 },
    )
  }

  try {
    await payload.delete({ collection: 'gallery-images', id, overrideAccess: true })
    return apiOk()
  } catch (e: unknown) {
    return apiError(errorMessage(e, 'Не удалось удалить изображение'), 500)
  }
})
