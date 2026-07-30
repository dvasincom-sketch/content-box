import { withAuthor, readJson, apiError, apiOk } from '@/app/(studio)/studio/api/_lib'
import { slugify } from '@/lib/slugify'
import type { Payload } from 'payload'

/**
 * Одобрить заявку UGC (Фаза 4): создаётся publication (с подписью автора и
 * разделом), заявка помечается approved. Общая лента (feed) — только платным
 * авторам (реш.5,7): иначе принудительно community.
 */
async function uniqueSlug(payload: Payload, tenantId: number, base: string): Promise<string> {
  let slug = base || 'post'
  let n = 1
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const ex = await payload.find({
      collection: 'publications',
      where: { and: [{ tenant: { equals: tenantId } }, { slug: { equals: slug } }] },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (ex.docs.length === 0) return slug
    n++
    slug = `${base}-${n}`
    if (n > 50) return `${base}-${n}`
  }
}

export const POST = withAuthor(async ({ req, payload, tenantId, author }) => {
  const data = await readJson(req)
  if (data === undefined) return apiError('Некорректный запрос')
  const id = Number(data.id)
  if (!id) return apiError('Не указана заявка')
  let section: 'feed' | 'community' = data.section === 'community' ? 'community' : 'feed'

  const sub = (await payload
    .findByID({ collection: 'submissions', id, depth: 1, overrideAccess: true })
    .catch(() => null)) as any
  const sTenant = sub && (typeof sub.tenant === 'object' ? sub.tenant?.id : sub.tenant)
  if (!sub || Number(sTenant) !== Number(tenantId)) return apiError('Заявка не найдена', 404)
  if (sub.status !== 'pending') return apiError('Заявка уже обработана')

  const authorSub = sub.author
  const authorId = authorSub && typeof authorSub === 'object' ? authorSub.id : authorSub
  const authorPaid = Boolean(authorSub && typeof authorSub === 'object' && authorSub.activeTier)
  if (section === 'feed' && !authorPaid) section = 'community' // общая лента — только платным

  const categoryRel = sub.category
  const categoryId = categoryRel && typeof categoryRel === 'object' ? categoryRel.id : categoryRel

  try {
    const slug = await uniqueSlug(payload, Number(tenantId), slugify(sub.title) || 'post')
    const pub = await payload.create({
      collection: 'publications',
      data: {
        title: sub.title,
        slug,
        tenant: tenantId,
        description: sub.body ?? null,
        author: authorId,
        section,
        ...(categoryId ? { category: categoryId } : {}),
        publishedAt: new Date().toISOString(),
      } as any,
      overrideAccess: true,
    })
    await payload.update({
      collection: 'submissions',
      id,
      data: { status: 'approved', section, publication: pub.id, reviewedBy: (author as any).id } as any,
      overrideAccess: true,
    })
    return apiOk({ publicationId: pub.id, slug })
  } catch (e: any) {
    return apiError(e?.message || 'Не удалось одобрить', 500)
  }
})
