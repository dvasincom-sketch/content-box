import { withAuthor, apiOk } from '@/app/(studio)/studio/api/_lib'

/**
 * Лёгкий опрос статуса обработки видео для студии. Возвращает assetStatus по
 * списку id — чтобы список видео обновлял «Обрабатывается → Готово» БЕЗ полного
 * router.refresh() (тот перезагружал всю страницу на 214 видео и мигал экраном).
 *
 * GET ?ids=1,2,3 → { ok, statuses: { [id]: 'processing'|'ready'|'error'|null } }
 */
export const runtime = 'nodejs'

export const GET = withAuthor(async ({ req, payload, tenantId }) => {
  const raw = req.nextUrl.searchParams.get('ids') || ''
  const ids = raw
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n > 0)
    .slice(0, 100)
  if (!ids.length) return apiOk({ statuses: {} })

  const res = await payload.find({
    collection: 'videos',
    where: { and: [{ tenant: { equals: tenantId } }, { id: { in: ids } }] },
    depth: 0,
    limit: 100,
    overrideAccess: true,
  })
  const statuses: Record<string, string | null> = {}
  for (const v of res.docs as any[]) statuses[String(v.id)] = (v.assetStatus as string) || null
  return apiOk({ statuses })
})
