import { withAuthor, readJson, apiError, apiOk, isContributor } from '@/app/(studio)/studio/api/_lib'
import { htmlToLexical } from '@/lib/lexical'
import { slugify } from '@/lib/slugify'
import { errorMessage } from '@/lib/errorMessage'
import type { Payload } from 'payload'

/**
 * Создание новой страницы проекта.
 * Body: { title }. slug генерируется из заголовка и делается уникальным в тенанте.
 * Контент пустой (заполняется потом в PageEditPanel). showInMenu/Footer = false.
 * Ответ: { ok, id, slug }
 */
export const POST = withAuthor(async ({ req, payload, tenantId, author }) => {
  if (isContributor(author)) return apiError('Доступно только владельцу студии', 403)
  const data = await readJson(req)
  if (data === undefined) return apiError('Некорректный запрос')

  const title = typeof data.title === 'string' ? data.title.trim() : ''
  if (!title) return apiError('Укажите заголовок страницы')

  const base = slugify(title) || 'page'
  const slug = await ensureUniqueSlug(payload, tenantId, base)

  try {
    const doc = await payload.create({
      collection: 'pages',
      data: {
        tenant: tenantId,
        title,
        slug,
        content: htmlToLexical(''),
        showInMenu: false,
        showInFooter: false,
      } as any,
      overrideAccess: true,
    })
    return apiOk({ id: (doc as any).id, slug })
  } catch (e: unknown) {
    return apiError(errorMessage(e, 'Не удалось создать страницу'))
  }
})

async function ensureUniqueSlug(payload: Payload, tenantId: number, base: string): Promise<string> {
  let candidate = base
  let n = 2
  for (let i = 0; i < 60; i++) {
    const res = await payload.find({
      collection: 'pages',
      where: { and: [{ tenant: { equals: tenantId } }, { slug: { equals: candidate } }] },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if ((res.docs as any[]).length === 0) return candidate
    candidate = base + '-' + n
    n += 1
  }
  return base + '-' + n
}
