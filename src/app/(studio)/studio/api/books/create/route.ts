import { withAuthor, readJson, apiError, apiOk } from '@/app/(studio)/studio/api/_lib'
import { slugify } from '@/lib/slugify'
import { errorMessage } from '@/lib/errorMessage'

/**
 * Создание книги. Минимум — название; остальное правится в редакторе книги.
 * Body: { title, slug? }
 */
export const POST = withAuthor(async ({ req, payload, tenantId }) => {
  const data = await readJson(req)
  if (data === undefined) return apiError('Некорректный запрос')
  const title = String(data.title || '').trim()
  if (!title) return apiError('Укажите название')

  const base = slugify(data.slug || title) || 'book'
  const slug = await uniqueSlug(payload, tenantId, base)

  try {
    const doc = await payload.create({
      collection: 'books' as any,
      data: {
        title, slug, tenant: tenantId, status: 'ongoing', freeChapters: 0,
        type: ['novel', 'story', 'mini', 'cycle'].includes(data.type) ? data.type : 'novel',
        publishedAt: new Date().toISOString(),
      } as any,
      overrideAccess: true,
    })
    return apiOk({ id: (doc as any).id, slug })
  } catch (e: unknown) {
    return apiError(errorMessage(e, 'Не удалось создать книгу'), 500)
  }
})

async function uniqueSlug(payload: any, tenantId: number, base: string): Promise<string> {
  let candidate = base
  for (let n = 1; n < 100; n++) {
    const res = await payload.find({
      collection: 'books' as any,
      where: { and: [{ tenant: { equals: tenantId } }, { slug: { equals: candidate } }] },
      limit: 1, depth: 0, overrideAccess: true,
    })
    if (res.totalDocs === 0) return candidate
    candidate = `${base}-${n + 1}`
  }
  return `${base}-${Date.now()}`
}
