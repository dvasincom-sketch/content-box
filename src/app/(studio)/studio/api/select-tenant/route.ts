import { NextResponse, type NextRequest } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { authenticatedUser } from '@/lib/currentUser'
import { isSameOrigin, isMutating } from '@/lib/sameOrigin'
import { ACTING_TENANT_COOKIE } from '@/lib/currentAuthor'
import type { User } from '@/payload-types'

/**
 * Выбор «активного тенанта» для платформенного администратора (superadmin) в
 * студии. Ставит httpOnly-cookie ACTING_TENANT_COOKIE = id тенанта; после этого
 * getCurrentAuthor отдаёт superadmin как автора выбранного проекта, и вся студия
 * скоупится на него.
 *
 * Body: { tenantId: number }
 * Гейт: только user из коллекции users с platformRole='superadmin'. Обычному
 * автору cookie бесполезна (getCurrentAuthor учитывает её лишь для superadmin),
 * но запрос всё равно отклоняем — 403.
 */
export async function POST(req: NextRequest) {
  if (isMutating(req.method) && !isSameOrigin(req)) {
    return NextResponse.json({ error: 'Запрос с постороннего origin' }, { status: 403 })
  }

  const u = await authenticatedUser()
  if (!u || u.collection !== 'users' || (u as User).platformRole !== 'superadmin') {
    return NextResponse.json({ error: 'Доступно только платформенному администратору' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Некорректный запрос' }, { status: 400 })
  }
  const tenantId = Number((body as { tenantId?: unknown } | null)?.tenantId)
  if (!Number.isFinite(tenantId) || tenantId <= 0) {
    return NextResponse.json({ error: 'Не указан проект' }, { status: 400 })
  }

  const payload = await getPayload({ config: await config })
  try {
    await payload.findByID({ collection: 'tenants', id: tenantId, depth: 0, overrideAccess: true })
  } catch {
    return NextResponse.json({ error: 'Проект не найден' }, { status: 404 })
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set(ACTING_TENANT_COOKIE, String(tenantId), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 дней
  })
  return res
}
