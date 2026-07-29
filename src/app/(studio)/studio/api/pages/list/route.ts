import { withAuthor, apiOk } from '@/app/(studio)/studio/api/_lib'

/**
 * Список страниц тенанта для панели «Страницы» в настройках.
 * Ответ: { ok, pages: [{ id, title, slug, showInMenu, showInFooter }] }
 */
export const GET = withAuthor(async ({ payload, tenantId }) => {
  const res = await payload.find({
    collection: 'pages',
    where: { tenant: { equals: tenantId } },
    sort: 'title',
    limit: 200,
    depth: 0,
    overrideAccess: true,
  })
  const pages = (res.docs as any[]).map((p) => ({
    id: p.id,
    title: p.title ?? '',
    slug: p.slug ?? '',
    showInMenu: Boolean(p.showInMenu),
    showInFooter: Boolean(p.showInFooter),
  }))
  return apiOk({ pages })
})
