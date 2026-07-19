import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getCurrentAuthor } from '@/lib/currentAuthor'

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

export async function GET() {
  const author = await getCurrentAuthor()
  if (!author) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const payload = await getPayload({ config: await config })

  const res = await payload.find({
    collection: 'site-settings',
    where: { tenant: { equals: author.tenantId } },
    limit: 1,
    depth: 1,
    overrideAccess: true,
  })
  const settings = res.docs[0] as any
  if (!settings) {
    return NextResponse.json({ error: 'Настройки сайта не найдены' }, { status: 404 })
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

  return NextResponse.json({
    ok: true,
    heroTeam: {
      members,
      caption: ht.caption ?? '',
      avatarSize: ht.avatarSize ?? '96',
    },
  })
}
