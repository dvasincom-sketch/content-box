import { authenticatedUser } from '@/lib/currentUser'
import { cookies } from 'next/headers.js'
import type { User } from '@/payload-types'

/**
 * Имя httpOnly-cookie с id «активного тенанта» для платформенного администратора
 * (superadmin) в студии. Ставится роутом `/studio/api/select-tenant` только для
 * superadmin; читается ниже. Для обычных авторов cookie игнорируется.
 */
export const ACTING_TENANT_COOKIE = 'studio_tenant'

/**
 * Текущий залогиненный АВТОР на серверной стороне.
 *
 * Читает httpOnly-cookie через payload.auth и возвращает user ТОЛЬКО если:
 *   - он из коллекции `users` (не subscriber),
 *   - у него есть привязка к тенанту (tenantRole-плоскость),
 *   ЛИБО он superadmin, выбравший активный тенант через переключатель студии.
 *
 * Superadmin (platformRole: 'superadmin', tenant: null) входит в студию под
 * ВЫБРАННЫЙ тенант: id лежит в cookie ACTING_TENANT_COOKIE. Нет валидной
 * cookie → null, и `(app)/layout` уводит его на `/studio/select-tenant`.
 * Так вся студия и все её роуты автоматически скоупятся на выбранный проект,
 * не требуя правок в ~57 роутах (они читают только `tenantId`).
 *
 * Возвращает { user, tenantId, isSuperadmin? } либо null.
 */
export async function getCurrentAuthor(): Promise<{
  user: User
  tenantId: number
  isSuperadmin?: boolean
} | null> {
  const user = await authenticatedUser()
  if (!user || user.collection !== 'users') return null
  if ((user as { disabled?: boolean }).disabled) return null

  // Платформенный администратор: активный тенант — из cookie (ставит только
  // роут select-tenant, и только для superadmin). Подделка cookie обычным
  // юзером бессмысленна: сюда попадает лишь ветка platformRole === 'superadmin'.
  if (user.platformRole === 'superadmin') {
    const store = await cookies()
    const raw = store.get(ACTING_TENANT_COOKIE)?.value
    const actingId = raw ? Number(raw) : NaN
    if (!Number.isFinite(actingId) || actingId <= 0) return null
    return { user, tenantId: actingId, isSuperadmin: true }
  }

  // tenant может прийти как id (number) или как populated-объект
  const rawTenant = user.tenant
  const tenantId =
    rawTenant && typeof rawTenant === 'object' ? rawTenant.id : rawTenant

  if (!tenantId) return null

  return { user, tenantId }
}

/** where-фрагмент «только своё» для участника (contributor); иначе null. */
export function contributorOwnerFilter(
  author: { user: { id: number | string; tenantRole?: string | null } },
): { owner: { equals: number | string } } | null {
  return author.user.tenantRole === 'contributor' ? { owner: { equals: author.user.id } } : null
}
