import { withAuthor, apiError, apiOk, isContributor, readJson } from '@/app/(studio)/studio/api/_lib'
import { errorMessage } from '@/lib/errorMessage'

/**
 * Удаление подписчика(ов). Только владелец студии, в пределах своего тенанта.
 * В отличие от блокировки (isBlocked) — удаляет запись полностью.
 *
 * Body:
 *   { subscriber: id }  — удалить одного (проверяем принадлежность тенанту);
 *   { demo: true }      — массово удалить ДЕМО-аккаунты (сид seed-army-*@….local).
 *
 * ВАЖНО: телефонные аккаунты тоже имеют синтетический email на .local
 * (<phone>@phone.contentbox.local) — это РЕАЛЬНЫЕ пользователи, вошедшие по
 * звонку/номеру. Их из «демо» исключаем (иначе они удаляются и создаются заново
 * при следующем входе). Демо = .local И без номера телефона.
 */
export const runtime = 'nodejs'

/** Демо-адрес: синтетический .local, НО не телефонный (@phone.*). */
function isDemoEmail(email: string): boolean {
  const e = String(email || '').trim().toLowerCase()
  if (!e.endsWith('.local')) return false
  if (e.includes('@phone.')) return false // телефонные аккаунты — не демо
  return true
}

export const POST = withAuthor(async ({ req, payload, tenantId, author }) => {
  if (isContributor(author)) return apiError('Доступно только владельцу студии', 403)
  const data = await readJson(req)
  if (data === undefined) return apiError('Некорректный запрос')

  // ── Массовое удаление демо-аккаунтов ──────────────────────────────────────
  if (data.demo === true) {
    const res = await payload.find({
      collection: 'subscribers',
      // like — подстрочный поиск; точную проверку суффикса делаем в JS ниже.
      where: { and: [{ tenant: { equals: tenantId } }, { email: { like: '.local' } }] },
      limit: 2000,
      depth: 0,
      overrideAccess: true,
    })
    // Демо = .local, не @phone.* И без номера телефона (двойная защита реальных
    // телефонных пользователей).
    const demos = (res.docs as { id: number | string; email: string; phone?: string | null }[]).filter(
      (u) => isDemoEmail(u.email) && !(u.phone && String(u.phone).trim()),
    )
    let deleted = 0
    const failed: string[] = []
    for (const u of demos) {
      try {
        await payload.delete({ collection: 'subscribers', id: u.id, overrideAccess: true })
        deleted++
      } catch {
        failed.push(String(u.email))
      }
    }
    return apiOk({ deleted, failed, total: demos.length })
  }

  // ── Удаление одного подписчика ────────────────────────────────────────────
  const id = data.subscriber
  if (id === null || id === undefined || id === '') return apiError('Не указан пользователь')

  // Подписчик обязан принадлежать текущему тенанту (защита от удаления чужого
  // зрителя по угаданному id).
  const sub = await payload
    .findByID({ collection: 'subscribers', id, depth: 0, overrideAccess: true })
    .catch(() => null)
  const subTenant =
    sub && (typeof (sub as { tenant?: unknown }).tenant === 'object'
      ? (sub as { tenant?: { id?: unknown } }).tenant?.id
      : (sub as { tenant?: unknown }).tenant)
  if (!sub || String(subTenant) !== String(tenantId)) return apiError('Пользователь не найден', 404)

  try {
    await payload.delete({ collection: 'subscribers', id, overrideAccess: true })
    return apiOk({ id, deleted: 1 })
  } catch (e: unknown) {
    return apiError(
      errorMessage(e, 'Не удалось удалить — возможно, у пользователя есть связанные данные. Тогда лучше заблокировать.'),
      500,
    )
  }
})
