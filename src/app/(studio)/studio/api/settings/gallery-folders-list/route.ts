import { withAuthor, apiOk } from '@/app/(studio)/studio/api/_lib'

/**
 * Список папок галереи тенанта для селекта в конструкторе главной (секция
 * «Фото на весь экран»). Возвращает { folders: [{ id, title, slug }] }.
 */
export const GET = withAuthor(async ({ payload, tenantId }) => {
  const res = await payload.find({
    collection: 'gallery-folders',
    where: { tenant: { equals: tenantId } },
    sort: 'title',
    limit: 200,
    depth: 0,
    overrideAccess: true,
  })
  const folders = (res.docs as any[]).map((f) => ({ id: f.id, title: f.title ?? '', slug: f.slug ?? '' }))
  return apiOk({ folders })
})
