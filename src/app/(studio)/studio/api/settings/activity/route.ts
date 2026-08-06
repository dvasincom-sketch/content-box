import { withAuthor, apiError, apiOk, isContributor } from '@/app/(studio)/studio/api/_lib'

/**
 * Лента активности студии (владелец). Последние 50 событий тенанта,
 * с populated пользователем (имя/почта). Только чтение.
 */
export const GET = withAuthor(async ({ payload, tenantId, author }) => {
  if (isContributor(author)) return apiError('Доступно только владельцу студии', 403)
  const res = await payload.find({
    collection: 'studio-activity' as any,
    where: { tenant: { equals: tenantId } },
    sort: '-createdAt',
    limit: 50,
    depth: 1,
    overrideAccess: true,
  })
  const items = (res.docs as any[]).map((d) => ({
    id: d.id,
    action: d.action,
    entity: d.entity || '',
    title: d.title || '',
    at: d.createdAt,
    user: d.user && typeof d.user === 'object' ? d.user.name || d.user.email || '—' : '—',
  }))
  return apiOk({ items })
})
