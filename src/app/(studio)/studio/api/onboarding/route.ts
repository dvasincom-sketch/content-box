import { withAuthor, readJson, apiError, apiOk, isContributor } from '@/app/(studio)/studio/api/_lib'
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

// Архетип «что создаёшь». `course` пока «Скоро» — в мастере не выбирается.
const ARCHETYPES = ['writer', 'video', 'course', 'podcast', 'expert', 'studio']
// Дефолтный тема-пресет по архетипу (id из lib/themePresets). course — позже.
const ARCHETYPE_PRESET: Record<string, string> = {
  writer: 'warm-earth',
  video: 'tropic-sunset',
  podcast: 'digital-monolith',
  expert: 'frost',
  studio: 'neon-dawn',
}

export const POST = withAuthor(async ({ req, payload, tenantId, author }) => {
  if (isContributor(author)) return apiError('Доступно только владельцу студии', 403)
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

  if (body.archetype !== undefined && body.archetype !== '') {
    if (typeof body.archetype !== 'string' || !ARCHETYPES.includes(body.archetype)) {
      return apiError('Неизвестный тип проекта.')
    }
    if (body.archetype === 'course') return apiError('Курсы скоро — выберите другой вариант.')
    patch.archetype = body.archetype
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
    // Поддомен *.contentbox.site — наш апекс, отдельная DNS-TXT верификация не
    // нужна: сразу помечаем домен подтверждённым и активируем тенант, чтобы сайт
    // автора заработал сам, без ручного участия персонала.
    patch.domainVerified = true
    patch.status = 'active'
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

  // Авто-оформление: по архетипу проставляем дефолтный тема-пресет (не критично).
  const arch = patch.archetype as string | undefined
  if (arch && ARCHETYPE_PRESET[arch]) {
    try {
      const ss = await payload.find({
        collection: 'site-settings',
        where: { tenant: { equals: tenantId } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      const doc = ss.docs[0] as any
      if (doc) {
        await payload.update({
          collection: 'site-settings',
          id: doc.id,
          data: { themePreset: ARCHETYPE_PRESET[arch] } as any,
          overrideAccess: true,
        })
      }
    } catch { /* тема не критична для онбординга */ }
  }

  return apiOk({
    subdomain: patch.subdomain ?? undefined,
    domain: patch.domain ?? undefined,
  })
})
