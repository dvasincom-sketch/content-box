import { withAuthor, apiError, apiOk } from '@/app/(studio)/studio/api/_lib'

/**
 * Чтение конфигурации секции «Участники» (heroTeam) для редактора в студии.
 * SiteSettings — одна запись на тенант. Возвращаем форму, удобную UI:
 * по каждому участнику photoId (media id) + photoUrl (превью) + name +
 * categoryId; плюс caption и avatarSize.
 *
 * depth: 1 — чтобы photo (upload) и category (relationship) пришли объектами,
 * из них берём url фото и id категории.
 *
 * Ответ: { ok, heroTeam: { members: [...], caption, avatarSize } } | { error }
 */

export const GET = withAuthor(async ({ payload, tenantId }) => {
  const res = await payload.find({
    collection: 'site-settings',
    where: { tenant: { equals: tenantId } },
    limit: 1,
    depth: 1,
    overrideAccess: true,
  })
  const settings = res.docs[0] as any
  if (!settings) {
    return apiError('Настройки сайта не найдены', 404)
  }

  const ht = settings.heroTeam || {}
  const rawMembers = Array.isArray(ht.members) ? ht.members : []

  const members = rawMembers.map((m: any) => {
    const photo = m?.photo
    const category = m?.category
    return {
      photoId: photo && typeof photo === 'object' ? photo.id : photo ?? null,
      photoUrl: photo && typeof photo === 'object' ? photo.url ?? null : null,
      name: m?.name ?? '',
      categoryId:
        category && typeof category === 'object' ? category.id : category ?? null,
    }
  })

  return apiOk({
    heroTeam: {
      members,
      caption: ht.caption ?? '',
      avatarSize: ht.avatarSize ?? '96',
    },
  })
})
