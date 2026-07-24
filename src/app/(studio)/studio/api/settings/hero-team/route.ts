import { withAuthor, readJson, apiError, apiOk, findTenantSettings } from '@/app/(studio)/studio/api/_lib'

/**
 * Сохранение секции «Участники» (heroTeam) целиком. SiteSettings — одна запись
 * на тенант. Обновляем group-поле heroTeam: массив участников + подпись + размер.
 *
 * Body: {
 *   members: [{ photo: id, name?: string, category?: id|null }],
 *   caption?: string,
 *   avatarSize?: '48'|'64'|'96'|'128'
 * }
 *
 * photo обязателен у каждого участника (в схеме required). category
 * необязательна (пустая → null). avatarSize валидируется по списку.
 */

const AVATAR_SIZES = ['48', '64', '96', '128']
const DEFAULT_AVATAR_SIZE = '96'

export const POST = withAuthor(async ({ req, payload, tenantId }) => {
  const data = await readJson(req)
  if (data === undefined) return apiError('Некорректный запрос')

  const rawMembers = Array.isArray(data.members) ? data.members : []
  const members: { photo: number | string; name: string; category: number | string | null }[] = []

  for (const m of rawMembers) {
    const photo = m?.photo
    // photo обязателен (media id — число или строка), иначе участник невалиден
    if (photo === null || photo === undefined || photo === '') {
      return apiError('У каждого участника должно быть фото')
    }
    const category =
      m?.category === null || m?.category === undefined || m?.category === ''
        ? null
        : m.category
    members.push({
      photo,
      name: typeof m?.name === 'string' ? m.name : '',
      category,
    })
  }

  const caption = typeof data.caption === 'string' ? data.caption : ''

  let avatarSize = String(data.avatarSize ?? '')
  if (!AVATAR_SIZES.includes(avatarSize)) avatarSize = DEFAULT_AVATAR_SIZE

  const settings = await findTenantSettings(payload, tenantId)
  if (!settings) {
    return apiError('Настройки сайта не найдены', 404)
  }

  try {
    await payload.update({
      collection: 'site-settings',
      id: settings.id,
      data: { heroTeam: { members, caption, avatarSize } } as any,
      overrideAccess: true,
    })
    return apiOk()
  } catch (e: any) {
    return apiError(e?.message || 'Не удалось сохранить')
  }
})
