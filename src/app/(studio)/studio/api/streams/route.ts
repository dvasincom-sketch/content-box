import { withAuthor, readJson, apiError, apiOk, isContributor } from '@/app/(studio)/studio/api/_lib'
import { errorMessage } from '@/lib/errorMessage'
import { slugify } from '@/lib/slugify'
import { validateStreamInput, toPayloadData, mapStream } from './_helpers'

/**
 * Список и создание трансляций. Только владелец студии, в пределах тенанта.
 * GET → { items }. POST { title, scheduledAt, endsAt, minTierId, playbackUrl,
 * coverId?, chatEnabled?, saveRecording?, ingestServer?, ingestKey?, recordingUrl? }.
 */
export const runtime = 'nodejs'

export const GET = withAuthor(async ({ payload, tenantId, author }) => {
  if (isContributor(author)) return apiError('Доступно только владельцу студии', 403)
  const res = await payload.find({
    collection: 'streams' as any,
    where: { tenant: { equals: tenantId } },
    sort: '-scheduledAt',
    limit: 200,
    depth: 1,
    overrideAccess: true,
  })
  return apiOk({ items: (res.docs as any[]).map(mapStream) })
})

export const POST = withAuthor(async ({ req, payload, tenantId, author }) => {
  if (isContributor(author)) return apiError('Доступно только владельцу студии', 403)
  const data = await readJson(req)
  if (data === undefined) return apiError('Некорректный запрос')

  const v = await validateStreamInput(data, payload, tenantId)
  if ('error' in v) return apiError(v.error)

  try {
    const doc = await payload.create({
      collection: 'streams' as any,
      data: {
        ...toPayloadData(v.data),
        tenant: tenantId,
        owner: author.user.id,
        slug: slugify(v.data.title) || String(Date.now()),
      } as any,
      overrideAccess: true,
    })
    return apiOk({ id: (doc as any).id })
  } catch (e: unknown) {
    return apiError(errorMessage(e, 'Не удалось создать трансляцию'), 500)
  }
})
