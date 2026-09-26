import { withAuthor, readJson, apiError, apiOk, isContributor } from '@/app/(studio)/studio/api/_lib'
import { normModIds } from '@/app/api/stream/chat/_mod'

/**
 * Сквозные настройки трансляций (владелец студии). Пока — общий список
 * модераторов чата (id подписчиков), применяемый ко всем трансляциям.
 * GET → { moderatorIds }. POST { moderatorIds:number[] } → сохранить.
 */
export const runtime = 'nodejs'

async function settingsDoc(payload: any, tenantId: string | number) {
  const res = await payload.find({
    collection: 'site-settings',
    where: { tenant: { equals: tenantId } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  return (res.docs as any[])[0] || null
}

export const GET = withAuthor(async ({ payload, tenantId, author }) => {
  if (isContributor(author)) return apiError('Доступно только владельцу студии', 403)
  const doc = await settingsDoc(payload, tenantId)
  return apiOk({ moderatorIds: normModIds(doc?.streamModeratorIds) })
})

export const POST = withAuthor(async ({ req, payload, tenantId, author }) => {
  if (isContributor(author)) return apiError('Доступно только владельцу студии', 403)
  const data = await readJson(req)
  if (data === undefined) return apiError('Некорректный запрос')

  const wanted = normModIds((data as any).moderatorIds)
  // Оставляем только реальных подписчиков этого тенанта.
  let moderatorIds: number[] = []
  if (wanted.length) {
    const res = await payload.find({
      collection: 'subscribers',
      where: { and: [{ tenant: { equals: tenantId } }, { id: { in: wanted } }] },
      limit: 500,
      depth: 0,
      overrideAccess: true,
    })
    const valid = new Set((res.docs as any[]).map((s) => Number(s.id)))
    moderatorIds = wanted.filter((id) => valid.has(id))
  }

  const doc = await settingsDoc(payload, tenantId)
  if (!doc) return apiError('Настройки сайта не найдены', 404)
  try {
    await payload.update({
      collection: 'site-settings',
      id: doc.id,
      data: { streamModeratorIds: moderatorIds } as any,
      overrideAccess: true,
    })
    return apiOk({ moderatorIds })
  } catch {
    return apiError('Не удалось сохранить', 500)
  }
})
