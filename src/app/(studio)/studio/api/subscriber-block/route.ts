import { withAuthor, apiError, apiOk, isContributor, readJson } from '@/app/(studio)/studio/api/_lib'
import { errorMessage } from '@/lib/errorMessage'

/**
 * Блокировка / разблокировка подписчика (поле isBlocked). Только владелец
 * студии, в пределах своего тенанта. isBlocked проверяется в слое доступа
 * (видео, публикации, книги, загрузки, комментарии, реакции) — заблокированный
 * теряет доступ к платному контенту и не может комментировать/реагировать.
 * Сам вход при этом не запрещаем.
 *
 * Body: { subscriber: id, blocked: boolean }
 */
export const POST = withAuthor(async ({ req, payload, tenantId, author }) => {
  if (isContributor(author)) return apiError('Доступно только владельцу студии', 403)

  const data = await readJson(req)
  if (data === undefined) return apiError('Некорректный запрос')

  const id = data.subscriber
  if (id === null || id === undefined || id === '') return apiError('Не указан пользователь')
  const blocked = Boolean(data.blocked)

  // Подписчик обязан принадлежать текущему тенанту (иначе владелец одного сайта
  // мог бы блокировать чужого зрителя по угаданному id).
  const sub = await payload
    .findByID({ collection: 'subscribers', id, depth: 0, overrideAccess: true })
    .catch(() => null)
  const subTenant =
    sub && (typeof (sub as any).tenant === 'object' ? (sub as any).tenant?.id : (sub as any).tenant)
  if (!sub || String(subTenant) !== String(tenantId)) return apiError('Пользователь не найден', 404)

  try {
    await payload.update({
      collection: 'subscribers',
      id,
      data: { isBlocked: blocked } as any,
      overrideAccess: true,
    })
    return apiOk({ id, isBlocked: blocked })
  } catch (e: unknown) {
    return apiError(errorMessage(e, 'Не удалось сохранить'))
  }
})
