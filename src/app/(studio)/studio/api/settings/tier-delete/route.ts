import { NextResponse, type NextRequest } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getCurrentAuthor } from '@/lib/currentAuthor'

/**
 * Удаление уровня подписки. Проверяем принадлежность тенанту.
 * Body: { id }
 *
 * Внимание: если на уровень ссылаются видео (minTier) или подписчики
 * (activeTier), Payload может вернуть ошибку связи — тогда сообщаем об этом.
 */
export async function POST(req: NextRequest) {
  const author = await getCurrentAuthor()
  if (!author) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  let data: any
  try {
    data = await req.json()
  } catch {
    return NextResponse.json({ error: 'Некорректный запрос' }, { status: 400 })
  }

  const id = data.id
  if (!id) return NextResponse.json({ error: 'Не указан уровень' }, { status: 400 })

  const payload = await getPayload({ config: await config })

  const doc: any = await payload
    .findByID({ collection: 'subscription-tiers', id, depth: 0, overrideAccess: true })
    .catch(() => null)
  if (!doc) return NextResponse.json({ error: 'Уровень не найден' }, { status: 404 })
  const t = doc.tenant && typeof doc.tenant === 'object' ? doc.tenant.id : doc.tenant
  if (Number(t) !== Number(author.tenantId)) {
    return NextResponse.json({ error: 'Уровень не найден' }, { status: 404 })
  }

  try {
    await payload.delete({ collection: 'subscription-tiers', id, overrideAccess: true })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json(
      { error: 'Не удалось удалить — возможно, на уровень ссылаются видео или подписчики' },
      { status: 400 },
    )
  }
}
