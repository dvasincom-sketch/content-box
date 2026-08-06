import { withAuthor, readJson, apiError, apiOk, isContributor } from '@/app/(studio)/studio/api/_lib'
import { errorMessage } from '@/lib/errorMessage'

/**
 * Удалить участника НАВСЕГДА (жёсткое удаление аккаунта). Только владелец студии.
 * В отличие от revoke (отключение), удаляет запись users. Гварды: только
 * приглашённый участник (contributor) этого тенанта, не сам владелец.
 *
 * Контент, созданный участником (owner), не удаляется — связь `owner` станет
 * пустой; записи остаются у проекта. Если БД не даёт удалить (внешние ключи) —
 * возвращаем понятную ошибку с советом отключить вместо удаления.
 *
 * Body: { id }
 */
export const POST = withAuthor(async ({ req, payload, tenantId, author }) => {
  if (isContributor(author)) return apiError('Доступно только владельцу студии', 403)
  const data = await readJson(req)
  if (data === undefined) return apiError('Некорректный запрос')
  const id = data.id
  if (!id) return apiError('Не указан участник')
  if (Number(id) === Number(author.user.id)) return apiError('Нельзя удалить самого себя')

  const u: any = await payload.findByID({ collection: 'users', id, depth: 0, overrideAccess: true }).catch(() => null)
  if (!u) return apiError('Участник не найден', 404)
  const uTenant = u.tenant && typeof u.tenant === 'object' ? u.tenant.id : u.tenant
  if (Number(uTenant) !== Number(tenantId)) return apiError('Участник не найден', 404)
  if (u.tenantRole !== 'contributor') return apiError('Удалить можно только приглашённого участника')

  try {
    await payload.delete({ collection: 'users', id, overrideAccess: true })
  } catch (e: unknown) {
    return apiError(errorMessage(e, 'Не удалось удалить участника. Попробуйте «Отключить» вместо удаления.'), 500)
  }
  return apiOk()
})
