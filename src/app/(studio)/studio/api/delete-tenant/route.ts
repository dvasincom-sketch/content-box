import { NextResponse, type NextRequest } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { authenticatedUser } from '@/lib/currentUser'
import { isSameOrigin, isMutating } from '@/lib/sameOrigin'
import { ACTING_TENANT_COOKIE } from '@/lib/currentAuthor'
import type { User } from '@/payload-types'

/**
 * Удаление проекта (тенанта) платформенным администратором из пикера /studio.
 * Только superadmin. Multi-tenant плагин при удалении тенанта сам чистит его
 * контент по всем tenant-коллекциям; `users` в список плагина не входят —
 * удаляем их отдельно перед тенантом.
 *
 * Защита от случайного сноса «живого» проекта: если у тенанта есть контент
 * (публикации/видео/книги/файлы/подписчики) — отвечаем 409 со счётчиками, и
 * удаление проходит только при повторе с { force: true }.
 *
 * Body: { tenantId: number, force?: boolean }
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
  const force = (body as { force?: unknown } | null)?.force === true
  if (!Number.isFinite(tenantId) || tenantId <= 0) {
    return NextResponse.json({ error: 'Не указан проект' }, { status: 400 })
  }

  const payload = await getPayload({ config: await config })
  try {
    await payload.findByID({ collection: 'tenants', id: tenantId, depth: 0, overrideAccess: true })
  } catch {
    return NextResponse.json({ error: 'Проект не найден' }, { status: 404 })
  }

  // Защита: не сносим проект с контентом без явного подтверждения.
  if (!force) {
    const counts: Record<string, number> = {}
    const check: ('publications' | 'videos' | 'books' | 'downloads' | 'subscribers')[] = [
      'publications', 'videos', 'books', 'downloads', 'subscribers',
    ]
    for (const c of check) {
      try {
        const r = await payload.find({ collection: c, where: { tenant: { equals: tenantId } }, limit: 0, depth: 0, overrideAccess: true })
        if (r.totalDocs > 0) counts[c] = r.totalDocs
      } catch {
        /* коллекции может не быть в редких случаях — пропускаем */
      }
    }
    if (Object.keys(counts).length > 0) {
      return NextResponse.json({ error: 'not-empty', counts }, { status: 409 })
    }
  }

  try {
    // users не входят в auto-cleanup плагина — удаляем сами до тенанта.
    await payload.delete({ collection: 'users', where: { tenant: { equals: tenantId } }, overrideAccess: true })
    // Тенант: multi-tenant плагин зачистит остальные tenant-коллекции.
    await payload.delete({ collection: 'tenants', id: tenantId, overrideAccess: true })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Не удалось удалить проект'
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  const res = NextResponse.json({ ok: true })
  // Если удалили активный тенант superadmin — сбрасываем cookie выбора.
  const acting = req.cookies.get(ACTING_TENANT_COOKIE)?.value
  if (acting && Number(acting) === tenantId) {
    res.cookies.set(ACTING_TENANT_COOKIE, '', { path: '/', maxAge: 0 })
  }
  return res
}
