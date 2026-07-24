import { withAuthor, apiError, apiOk } from '@/app/(studio)/studio/api/_lib'

/**
 * Чтение секции «Hero» (заголовок главной) для редактора в студии.
 * Возвращает тексты (eyebrow, titleLines) + выбранные чипсы (heroChips) в
 * текущем порядке с id/title/coverUrl (для верхнего dnd-списка панели, как у
 * категорий-плиток). Полный список категорий (дерево+поиск) панель берёт из
 * /studio/api/settings/categories-list.
 *
 * depth: 1 — чтобы heroChips пришли объектами (id/title/cover).
 * titleLines отдаём как есть (сырая строка textarea с \n) — панель покажет в поле.
 *
 * Ответ: { ok, hero: { eyebrow, titleLines }, chips: [{ id, title, coverUrl }] } | { error }
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

  const hero = settings.hero || {}

  const rawChips = Array.isArray(settings.heroChips) ? settings.heroChips : []
  const chips = rawChips
    .filter((c: any) => c && typeof c === 'object')
    .map((c: any) => {
      const cover = c.cover
      const coverUrl = cover && typeof cover === 'object' ? (cover.url ?? null) : null
      return { id: c.id, title: c.title ?? '', coverUrl }
    })

  return apiOk({
    hero: {
      eyebrow: hero.eyebrow ?? '',
      titleLines: hero.titleLines ?? '',
    },
    chips,
  })
})
