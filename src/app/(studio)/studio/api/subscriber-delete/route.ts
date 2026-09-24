import { withAuthor, apiError, apiOk, isContributor, readJson } from '@/app/(studio)/studio/api/_lib'
import { errorMessage } from '@/lib/errorMessage'

/**
 * Удаление подписчика(ов). Только владелец студии, в пределах своего тенанта.
 * В отличие от блокировки (isBlocked) — удаляет запись полностью.
 *
 * Body:
 *   { subscriber: id }  — удалить одного (проверяем принадлежность тенанту);
 *   { demo: true }      — массово удалить демо-аккаунты (синтетический домен
 *                         *.local, напр. seed-army-01@cocojambo.local).
 *
 * Демо-аккаунты безопасны для удаления (фейковый домен, нет реальной активности).
 * Настоящего активного зрителя лучше блокировать, а не удалять — но выбор за
 * владельцем; если у записи есть связанные данные и БД не даёт удалить, вернём
 * понятную ошибку, ничего не сломав.
 */
export const runtime = 'nodejs'

/** Демо-адрес: синтетический домен верхнего уровня .local (не бывает в реальной
 *  почте) — им завели seed-army-*@cocojambo.local и подобные. */
function isDemoEmail(email: string): boolean {
  return String(email || '').trim().toLowerCase().endsWith('.local')
}

export const POST = withAuthor(async ({ req, payload, tenantId, author }) => {
  if (isContributor(author)) return apiError('Доступно только владельцу студии', 403)
  const data = await readJson(req)
  if (data === undefined) return apiError('Некорректный запрос')

  // ── Массовое удаление демо-аккаунтов (*.local) ────────────────────────────
  if (data.demo === true) {
    const res = await payload.find({
      collection: 'subscribers',
      // like — подстрочный поиск; точную проверку суффикса делаем в JS ниже.
      where: { and: [{ tenant: { equals: tenantId } }, { email: { like: '.local' } }] },
      limit: 1000,
      depth: 0,
      overrideAccess: true,
    })
    const demos = (res.docs as { id: number | string; email: string }[]).filter((u) => isDemoEmail(u.email))
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
