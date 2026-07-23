import { NextResponse, type NextRequest } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getCurrentAuthor } from '@/lib/currentAuthor'
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

export async function POST(req: NextRequest) {
  const author = await getCurrentAuthor()
  if (!author) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Некорректный запрос.' }, { status: 400 })
  }

  const payload = await getPayload({ config: await config })
  const patch: Record<string, unknown> = {}

  if (typeof body.name === 'string') {
    const name = body.name.trim()
    if (!name) return NextResponse.json({ error: 'Название проекта не может быть пустым.' }, { status: 400 })
    patch.name = name.slice(0, 200)
  }

  if (typeof body.description === 'string') {
    patch.description = body.description.trim().slice(0, 2000)
  }

  if (body.category !== undefined && body.category !== '') {
    if (typeof body.category !== 'string' || !CATEGORIES.includes(body.category)) {
      return NextResponse.json({ error: 'Неизвестная категория.' }, { status: 400 })
    }
    patch.category = body.category
  }

  if (typeof body.subdomain === 'string' && body.subdomain !== '') {
    const sub = normalizeSubdomain(body.subdomain)
    const err = subdomainError(sub)
    if (err) return NextResponse.json({ error: err }, { status: 400 })

    // Уникальность среди тенантов, исключая себя.
    const taken = await payload.find({
      collection: 'tenants',
      where: {
        and: [{ subdomain: { equals: sub } }, { id: { not_equals: author.tenantId } }],
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (taken.docs.length > 0) {
      return NextResponse.json({ error: 'Этот адрес уже занят. Выберите другой.' }, { status: 409 })
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
    return NextResponse.json({ ok: true })
  }

  try {
    await payload.update({
      collection: 'tenants',
      id: author.tenantId,
      data: patch as any,
      overrideAccess: true,
    })
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message || 'Не удалось сохранить.' },
      { status: 400 },
    )
  }

  return NextResponse.json({
    ok: true,
    subdomain: patch.subdomain ?? undefined,
    domain: patch.domain ?? undefined,
  })
}
