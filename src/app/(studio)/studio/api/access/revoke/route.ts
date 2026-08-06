import { withAuthor, readJson, apiError, apiOk, isContributor } from '@/app/(studio)/studio/api/_lib'
import { logActivity } from '@/lib/logActivity'
import { errorMessage } from '@/lib/errorMessage'

/**
 * Отозвать доступ участника (деактивация). Только владелец студии. Ставит
 * disabled:true — участник не может войти/пользоваться студией, но аккаунт и
 * авторство его контента сохраняются. Вернуть доступ — роут restore.
 *
 * Body: { id }
 */
export const POST = withAuthor(async ({ req, payload, tenantId, author }) => {
  if (isContributor(author)) return apiError('Доступно только владельцу студии', 403)
  const data = await readJson(req)
  if (data === undefined) return apiError('Некорректный запрос')
  const id = data.id
  if (!id) return apiError('Не указан участник')
  if (Number(id) === Number(author.user.id)) return apiError('Нельзя убрать самого себя')

  const u: any = await payload.findByID({ collection: 'users', id, depth: 0, overrideAccess: true }).catch(() => null)
  if (!u) return apiError('Участник не найден', 404)
  const uTenant = u.tenant && typeof u.tenant === 'object' ? u.tenant.id : u.tenant
  if (Number(uTenant) !== Number(tenantId)) return apiError('Участник не найден', 404)
  if (u.tenantRole !== 'contributor') return apiError('Убрать можно только приглашённого участника')

  try {
    await payload.update({ collection: 'users', id, data: { disabled: true } as any, overrideAccess: true })
  } catch (e: unknown) {
    return apiError(errorMessage(e, 'Не удалось отозвать доступ'), 500)
  }
  await logActivity(payload, { tenant: tenantId, user: author.user.id, action: 'update', entity: 'доступ', title: 'Отключён доступ участнику' })
  return apiOk()
})
