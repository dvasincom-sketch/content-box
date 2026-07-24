import { withAuthor, readJson, apiError, apiOk } from '@/app/(studio)/studio/api/_lib'
import { normalizeSubdomain, subdomainError, domainFromSubdomain } from '@/lib/subdomain'

/**
 * Сохранение шага мастера онбординга на `tenant` текущего автора.
 *
 * Тенант берётся из сессии (getCurrentAuthor) — любой id из тела игнорируется.
 * Принимает частичный набор полей + `step` (для возобновления) + `complete`.
 * Тело: { name?, description?, category?, subdomain?, step?, complete? }
 *
 * Аватар/логотип грузится отдельно (multipart) через /studio/api/settings/logo.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const CATEGORIES = ['blogger', 'musician', 'podcaster', 'streamer', 'artist', 'education', 'other']

export const POST = withAuthor(async ({ req, payload, tenantId }) => {
  const body = await readJson<Record<string, unknown>>(req)
  if (body === undefined) return apiError('Некорректный запрос.')

  const patch: Record<string, unknown> = {}

  if (typeof body.name === 'string') {
    const name = body.name.trim()
    if (!name) return apiError('Название проекта не может быть пустым.')
    patch.name = name.slice(0, 200)
  }

  if (typeof body.description === 'string') {
    patch.description = body.description.trim().slice(0, 2000)
  }

  if (body.category !== undefined && body.category !== '') {
    if (typeof body.category !== 'string' || !CATEGORIES.includes(body.category)) {
      return apiError('Неизвестная категория.')
    }
    patch.category = body.category
  }

  if (typeof body.subdomain === 'string' && body.subdomain !== '') {
    const sub = normalizeSubdomain(body.subdomain)
    const err = subdomainError(sub)
    if (err) return apiError(err)

    // Уникальность среди тенантов, исключая себя.
    const taken = await payload.find({
      collection: 'tenants',
      where: {
        and: [{ subdomain: { equals: sub } }, { id: { not_equals: tenantId } }],
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (taken.docs.length > 0) {
      return apiError('Этот адрес уже занят. Выберите другой.', 409)
    }
    patch.subdomain = sub
    patch.domain = domainFromSubdomain(sub)
  }

  if (typeof body.step === 'number' && Number.isFinite(body.step)) {
    patch.onboardingStep = Math.max(0, Math.floor(body.step))
  }

  if (body.complete === true) {
    patch.onboardingComplete = true
  }

  if (Object.keys(patch).length === 0) {
    return apiOk()
  }

  try {
    await payload.update({
      collection: 'tenants',
      id: tenantId,
      data: patch as any,
      overrideAccess: true,
    })
  } catch (e) {
    return apiError((e as Error).message || 'Не удалось сохранить.')
  }

  return apiOk({
    subdomain: patch.subdomain ?? undefined,
    domain: patch.domain ?? undefined,
  })
})
