import { NextResponse, type NextRequest } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getCurrentAuthor } from '@/lib/currentAuthor'

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

export async function POST(req: NextRequest) {
  const author = await getCurrentAuthor()
  if (!author) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  let data: any
  try {
    data = await req.json()
  } catch {
    return NextResponse.json({ error: 'Некорректный запрос' }, { status: 400 })
  }

  const rawMembers = Array.isArray(data.members) ? data.members : []
  const members: { photo: number | string; name: string; category: number | string | null }[] = []

  for (const m of rawMembers) {
    const photo = m?.photo
    // photo обязателен (media id — число или строка), иначе участник невалиден
    if (photo === null || photo === undefined || photo === '') {
      return NextResponse.json(
        { error: 'У каждого участника должно быть фото' },
        { status: 400 },
      )
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

  const payload = await getPayload({ config: await config })
  const settings = await findSettings(payload, author.tenantId)
  if (!settings) {
    return NextResponse.json({ error: 'Настройки сайта не найдены' }, { status: 404 })
  }

  try {
    await payload.update({
      collection: 'site-settings',
      id: settings.id,
      data: { heroTeam: { members, caption, avatarSize } } as any,
      overrideAccess: true,
    })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Не удалось сохранить' },
      { status: 400 },
    )
  }
}

/** Единственная запись site-settings тенанта. */
async function findSettings(payload: any, tenantId: number) {
  const res = await payload.find({
    collection: 'site-settings',
    where: { tenant: { equals: tenantId } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  return res.docs[0] || null
}
